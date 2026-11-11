#!/usr/bin/env bash
set -euo pipefail

test "$AWS_ACCOUNT_ID" = "425061472162"
test "$RELEASE_ENVIRONMENT" = development || test "$RELEASE_ENVIRONMENT" = production
test "$ROUTE_VERIFICATION_MODE" = shells_only || test "$ROUTE_VERIFICATION_MODE" = active_routes
mkdir -p .release
cp candidate/manifest.json .release/manifest.json
node infra/src/check-web-release.ts environment
node infra/src/web-candidate.ts verify candidate "$GITHUB_SHA" "$GITHUB_RUN_ID" "$CANDIDATE_MANIFEST_SHA256"
aws cloudformation describe-stacks --stack-name "rct-consulting-$RELEASE_ENVIRONMENT-foundation" > .release/stack.json
# The validator writes only checked stack outputs to this job's environment file.
GITHUB_ENV="$PWD/.release/target.env" node infra/src/check-web-release.ts stack .release/stack.json
set -a
source .release/target.env
set +a
aws s3api get-bucket-location --bucket "$PREVIEW_BUCKET" --expected-bucket-owner "$AWS_ACCOUNT_ID" > /dev/null
aws s3api get-public-access-block --bucket "$PREVIEW_BUCKET" --expected-bucket-owner "$AWS_ACCOUNT_ID" > .release/access-block.json
aws s3api get-bucket-policy-status --bucket "$PREVIEW_BUCKET" --expected-bucket-owner "$AWS_ACCOUNT_ID" > .release/policy-status.json
node infra/src/check-web-release.ts bucket .release/access-block.json .release/policy-status.json
aws cloudfront get-distribution --id "$PREVIEW_DISTRIBUTION_ID" > .release/distribution.json
node infra/src/check-web-release.ts distribution .release/distribution.json
curl --fail --retry 3 --retry-all-errors --max-time 30 --silent --show-error "$PREVIEW_API_URL/health" > .release/health.json
node infra/src/check-web-release.ts health .release/health.json
for path in /admin/leads /me /projects; do
  status=$(curl --max-time 30 --silent --show-error --output /dev/null --write-out "%{http_code}" "$PREVIEW_API_URL$path")
  test "$status" = "401"
done
status=$(curl --max-time 30 --silent --show-error --output /dev/null --write-out "%{http_code}" \
  -X POST -H 'Content-Type: application/json' --data '{}' "$PREVIEW_API_URL/leads")
test "$status" = "503"
if test "$RELEASE_ENVIRONMENT" = development; then
  curl --fail --max-time 30 --silent --show-error -D .release/headers --output /dev/null "$PREVIEW_WEB_URL/"
  grep -Eiq '^x-robots-tag:.*noindex' .release/headers
fi

invalidation=""
promotion_state=publishing
record_promotion() {
  printf '{"repository":"%s","sourceSha":"%s","runId":"%s","runAttempt":"%s","environment":"%s","manifestSha256":"%s","bucket":"%s","distributionId":"%s","invalidationId":"%s","state":"%s","exitStatus":%s}\n' \
    "$GITHUB_REPOSITORY" "$GITHUB_SHA" "$GITHUB_RUN_ID" "$GITHUB_RUN_ATTEMPT" "$RELEASE_ENVIRONMENT" \
    "$CANDIDATE_MANIFEST_SHA256" "$PREVIEW_BUCKET" "$PREVIEW_DISTRIBUTION_ID" "$invalidation" "$promotion_state" "$1" > .release/promotion.json
}
record_promotion 0
trap 'status=$?; if test "$status" -ne 0; then promotion_state=failed; fi; record_promotion "$status"' EXIT

# Snapshot the previous entry points; old content-addressed assets are never deleted.
exists=$(aws s3api list-objects-v2 --bucket "$PREVIEW_BUCKET" --prefix index.html --query "Contents[?Key=='index.html'].Key" --output text)
if test -n "$exists" && test "$exists" != None; then
  aws s3 cp "s3://$PREVIEW_BUCKET/index.html" .release/previous-index.html --only-show-errors
fi
aws s3 sync "s3://$PREVIEW_BUCKET/route-meta/" .release/previous-route-meta/ --only-show-errors
aws s3 sync candidate/ "s3://$PREVIEW_BUCKET/" --exclude "*" --include "assets/*" \
  --cache-control "public,max-age=31536000,immutable" --only-show-errors
for html in candidate/index.html candidate/route-meta/*.html; do
  key=$(printf '%s' "$html" | sed 's#^candidate/##')
  aws s3 cp "$html" "s3://$PREVIEW_BUCKET/$key" \
    --content-type "text/html" --cache-control "no-cache" --only-show-errors
done
invalidation=$(aws cloudfront create-invalidation --distribution-id "$PREVIEW_DISTRIBUTION_ID" \
  --paths "/*" --query Invalidation.Id --output text)
promotion_state=invalidating
record_promotion 0
aws cloudfront wait invalidation-completed --distribution-id "$PREVIEW_DISTRIBUTION_ID" --id "$invalidation"

verify_web_headers() {
  if test "$RELEASE_ENVIRONMENT" = development; then
    grep -Eiq '^x-robots-tag:.*noindex' .release/headers
  else
    if grep -Eiq '^x-robots-tag:.*(noindex|nofollow)' .release/headers; then exit 1; fi
  fi
}
curl --fail --retry 5 --retry-all-errors --max-time 30 --silent --show-error \
  -D .release/headers --output .release/published.html "$PREVIEW_WEB_URL/"
cmp candidate/index.html .release/published.html
verify_web_headers

if test "$ROUTE_VERIFICATION_MODE" = active_routes; then
  for path in /small-business /enterprise /work /services /approach /about /faq /contact \
    /services/digital-foundations /services/engineering-solutions /services/fractional-leadership \
    /services/ai-automation /services/cloud-cost-optimization /services/ai-automation/ \
    '/?workspace' '/?admin' '/?code=closed&state=closed'; do
    route_path=$(printf '%s' "$path" | sed 's/[?].*$//')
    if test "$route_path" != "/"; then route_path=$(printf '%s' "$route_path" | sed 's#/$##'); fi
    if test "$route_path" = "/"; then
      route_html=candidate/index.html
    else
      route_file=$(printf '%s' "$route_path" | sed 's#^/##; s#/#--#g')
      route_html="candidate/route-meta/$route_file.html"
    fi
    curl --fail --retry 5 --retry-all-errors --max-time 30 --silent --show-error \
      -D .release/headers --output .release/published.html "$PREVIEW_WEB_URL$path"
    cmp "$route_html" .release/published.html
    verify_web_headers
  done
fi

for html in candidate/route-meta/*.html; do
  key=$(printf '%s' "$html" | sed 's#^candidate/##')
  curl --fail --retry 3 --retry-all-errors --max-time 30 --silent --show-error \
    "$PREVIEW_WEB_URL/$key" > .release/published.html
  cmp "$html" .release/published.html
done
for asset in candidate/assets/*; do
  name=$(basename "$asset")
  curl --fail --retry 3 --retry-all-errors --max-time 30 --silent --show-error \
    "$PREVIEW_WEB_URL/assets/$name" > .release/published-asset
  cmp "$asset" .release/published-asset
done
for path in /not-a-public-route /route-meta/missing.html /assets/missing-release-check.js /api/not-a-public-route; do
  status=$(curl --max-time 30 --silent --show-error --output /dev/null --write-out "%{http_code}" "$PREVIEW_WEB_URL$path")
  test "$status" = "403" || test "$status" = "404"
done
promotion_state=verified
record_promotion 0
printf '### %s web promotion\n- Source: `%s`\n- Run: `%s` (attempt %s)\n- Candidate manifest SHA-256: `%s`\n- URL: %s\n- Intake closed; auth unconfigured; immutable assets retained.\n' \
  "$RELEASE_ENVIRONMENT" "$GITHUB_SHA" "$GITHUB_RUN_ID" "$GITHUB_RUN_ATTEMPT" "$CANDIDATE_MANIFEST_SHA256" "$PREVIEW_WEB_URL" >> "$GITHUB_STEP_SUMMARY"
if test "$ROUTE_VERIFICATION_MODE" = active_routes; then
  printf -- '- Route verification: all approved public paths match their static shells.\n' >> "$GITHUB_STEP_SUMMARY"
else
  printf -- '- Route verification: shells staged and byte-verified; clean public paths were not tested.\n' >> "$GITHUB_STEP_SUMMARY"
fi
