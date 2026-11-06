import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiHandler, handler, type Request } from "./handler.ts";
import { IdempotencyConflictError, InvalidLeadCursorError, LeadUpdateConflictError } from "./lead-store.ts";
import type { LeadReader, LeadWriter } from "./leads.ts";

function request(path: string, method = "GET", body?: unknown): Request {
  return {
    version: "2.0", routeKey: `${method} ${path}`, rawPath: path,
    rawQueryString: "", headers: {}, isBase64Encoded: false,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    requestContext: {
      accountId: "123456789012", apiId: "test", domainName: "api.example.invalid",
      domainPrefix: "api", requestId: "test", routeKey: `${method} ${path}`,
      stage: "$default", time: "2026-11-05T00:00:00Z", timeEpoch: 0,
      http: { method, path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
    },
  };
}

test("health exposes only safe application readiness, not dependency or account details", async () => {
  const result = await handler(request("/health"));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body!), { status: "ok", application: "consulting" });
  assert.equal((await handler(request("/health", "POST"))).statusCode, 404);
});

test("identity uses validated Gateway claims, never a request header or role payload", async () => {
  const event = request("/me");
  event.headers.authorization = "unverified";
  assert.equal((await handler(event)).statusCode, 401);
  event.requestContext.authorizer = { jwt: { claims: { sub: "synthetic-user" } } };
  assert.deepEqual(JSON.parse((await handler(event)).body!), { userId: "synthetic-user" });
  assert.equal((await handler(request("/admin/finance"))).statusCode, 404);
});

test("lead submissions stay closed until intake, consent and retention are explicitly configured", async () => {
  const event = request("/leads", "POST", validSubmission());
  event.headers["content-type"] = "application/json";
  event.headers["idempotency-key"] = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
  const api = createApiHandler({
    leadWriter: { create: async () => "created" },
    leadIntake: { enabled: false, consentPolicyVersion: "", retentionDays: 0 },
  });
  assert.equal((await api(event)).statusCode, 503);
});

test("accepted lead creates one atomic-safe sanitized reporting event and retries are idempotent", async () => {
  const writes: Parameters<LeadWriter["create"]>[] = [];
  const api = createApiHandler({
    leadWriter: { create: async (...args) => { writes.push(args); return writes.length === 1 ? "created" : "duplicate"; } },
    leadIntake: { enabled: true, consentPolicyVersion: "2026-01", retentionDays: 90 },
    now: () => new Date("2026-11-05T16:00:00.000Z"),
  });
  const event = request("/leads", "POST", validSubmission());
  event.headers["content-type"] = "application/json";
  event.headers["idempotency-key"] = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";

  const first = await api(event);
  const retry = await api(event);
  assert.equal(first.statusCode, 201);
  assert.equal(retry.statusCode, 200);
  assert.deepEqual(JSON.parse(first.body!), { status: "accepted" });
  assert.equal(writes.length, 2);
  assert.equal(writes[0]![0].expiresAt, Math.floor(Date.parse("2026-11-05T16:00:00.000Z") / 1000) + 90 * 86400);
  assert.deepEqual(writes[0]![1].detail.data, { reportingMonth: "2026-11", leadCount: 1 });
  assert.equal(JSON.stringify(writes[0]![1]).includes("person@example.com"), false);
  assert.equal(JSON.stringify(writes[0]![1]).includes("private inquiry"), false);
});

test("lead intake rejects bad consent, missing idempotency and oversized bodies", async () => {
  const api = createApiHandler({
    leadWriter: { create: async () => "created" },
    leadIntake: { enabled: true, consentPolicyVersion: "2026-01", retentionDays: 90 },
  });
  const badConsent = request("/leads", "POST", { ...validSubmission(), consentPolicyVersion: "old" });
  badConsent.headers["content-type"] = "application/json";
  badConsent.headers["idempotency-key"] = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
  assert.equal((await api(badConsent)).statusCode, 400);

  const noKey = request("/leads", "POST", validSubmission());
  noKey.headers["content-type"] = "application/json";
  assert.equal((await api(noKey)).statusCode, 400);

  const large = request("/leads", "POST", validSubmission());
  large.headers["content-type"] = "application/json";
  large.headers["idempotency-key"] = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
  large.body = "x".repeat(22_000);
  assert.equal((await api(large)).statusCode, 413);
});

test("lead intake rejects spam, unknown fields, invalid email and control characters", async () => {
  let writeCount = 0;
  const api = createApiHandler({
    leadWriter: { create: async () => { writeCount += 1; return "created"; } },
    leadIntake: { enabled: true, consentPolicyVersion: "2026-01", retentionDays: 90 },
  });
  const invalidBodies = [
    { ...validSubmission(), website: "https://spam.example" },
    { ...validSubmission(), unexpected: "extra" },
    { ...validSubmission(), email: "not-an-email" },
    { ...validSubmission(), name: "Riley\nExample" },
  ];
  for (const body of invalidBodies) {
    const event = request("/leads", "POST", body);
    event.headers["content-type"] = "application/json";
    event.headers["idempotency-key"] = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
    assert.equal((await api(event)).statusCode, 400);
  }
  const wrongContentType = request("/leads", "POST", validSubmission());
  wrongContentType.headers["content-type"] = "text/plain";
  wrongContentType.headers["idempotency-key"] = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
  assert.equal((await api(wrongContentType)).statusCode, 415);
  assert.equal(writeCount, 0);
});

test("reusing a submission key with different content returns conflict", async () => {
  const api = createApiHandler({
    leadWriter: { create: async () => { throw new IdempotencyConflictError(); } },
    leadIntake: { enabled: true, consentPolicyVersion: "2026-01", retentionDays: 90 },
  });
  const event = request("/leads", "POST", validSubmission());
  event.headers["content-type"] = "application/json";
  event.headers["idempotency-key"] = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
  assert.equal((await api(event)).statusCode, 409);
});

test("lead inbox requires the verified administrator group and returns a bounded page", async () => {
  let reads = 0;
  const api = createApiHandler({
    leadWriter: { create: async () => "created" },
    leadReader: {
      listLatest: async (cursor) => {
        reads += 1;
        assert.equal(cursor, undefined);
        return {
          leads: [{
            leadId: "lead-1", name: "Riley Example", email: "person@example.com",
            status: "NEW", version: 0,
            company: "", message: "Project inquiry", createdAt: "2026-11-05T16:00:00.000Z",
            consentedAt: "2026-11-05T16:00:00.000Z", consentPolicyVersion: "2026-01",
          }],
          nextToken: null,
        };
      },
    } satisfies LeadReader,
    leadIntake: { enabled: false, consentPolicyVersion: "", retentionDays: 0 },
  });
  const event = request("/admin/leads");
  event.requestContext.authorizer = { jwt: { claims: { sub: "member-1", "cognito:groups": ["Other"] } } };
  assert.equal((await api(event)).statusCode, 403);
  assert.equal(reads, 0);

  event.requestContext.authorizer = {
    jwt: { claims: { sub: "admin-1", "cognito:groups": '["ConsultingAdministrators"]' } },
  };
  const result = await api(event);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body!), {
    leads: [{
      leadId: "lead-1", name: "Riley Example", email: "person@example.com",
      status: "NEW", version: 0,
      company: "", message: "Project inquiry", createdAt: "2026-11-05T16:00:00.000Z",
      consentedAt: "2026-11-05T16:00:00.000Z", consentPolicyVersion: "2026-01",
    }],
    nextToken: null,
  });
  assert.equal(reads, 1);
});

test("lead inbox rejects invalid cursors without falling back to an unbounded query", async () => {
  const api = createApiHandler({
    leadWriter: { create: async () => "created" },
    leadReader: { listLatest: async () => { throw new InvalidLeadCursorError(); } },
    leadIntake: { enabled: false, consentPolicyVersion: "", retentionDays: 0 },
  });
  const event = request("/admin/leads");
  event.queryStringParameters = { nextToken: "invalid" };
  event.requestContext.authorizer = {
    jwt: { claims: { sub: "admin-1", "cognito:groups": ["ConsultingAdministrators"] } },
  };
  assert.equal((await api(event)).statusCode, 400);
});

test("status updates require verified admin claims and record the trusted actor", async () => {
  const writes: unknown[] = [];
  const api = createApiHandler({
    leadWriter: { create: async () => "created" },
    leadIntake: { enabled: false, consentPolicyVersion: "", retentionDays: 0 },
    leadStatusWriter: { updateStatus: async (...args) => {
      writes.push(args);
      return { status: "CONTACTED", version: 1 };
    } },
    now: () => new Date("2026-11-05T16:00:00.000Z"),
  });
  const event = statusRequest({ status: "CONTACTED", expectedVersion: 0 });
  delete event.requestContext.authorizer;
  event.headers.authorization = "unverified";
  assert.equal((await api(event)).statusCode, 401);
  event.requestContext.authorizer = { jwt: { claims: { sub: "member", "cognito:groups": "NotConsultingAdministrators" } } };
  assert.equal((await api(event)).statusCode, 403);
  assert.equal(writes.length, 0);
  event.requestContext.authorizer = { jwt: { claims: { sub: "admin-1", "cognito:groups": ["ConsultingAdministrators"] } } };
  const result = await api(event);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body!), { status: "CONTACTED", version: 1 });
  assert.deepEqual(writes[0], [
    "b9de9897-5f48-4a63-a872-1d1b53bd64a5", { status: "CONTACTED", expectedVersion: 0 },
    "admin-1", new Date("2026-11-05T16:00:00.000Z"),
  ]);
});

test("status update validation rejects arbitrary attributes, invalid versions and oversized payloads", async () => {
  const api = createApiHandler({
    leadWriter: { create: async () => "created" },
    leadIntake: { enabled: false, consentPolicyVersion: "", retentionDays: 0 },
    leadStatusWriter: { updateStatus: async () => { assert.fail("invalid input cannot write"); } },
  });
  for (const body of [
    { status: "INVALID", expectedVersion: 0 },
    { status: "NEW", expectedVersion: -1 },
    { status: "NEW", expectedVersion: 1.5 },
    { status: "NEW", expectedVersion: Number.MAX_SAFE_INTEGER },
    { status: "NEW", expectedVersion: 0, updatedBy: "forged" },
    { status: "NEW", expectedVersion: 0, expiresAt: 9999999999 },
  ]) assert.equal((await api(statusRequest(body))).statusCode, 400);
  const large = statusRequest({});
  large.body = "x".repeat(1500);
  assert.equal((await api(large)).statusCode, 413);
  const badId = statusRequest({ status: "NEW", expectedVersion: 0 });
  badId.rawPath = "/admin/leads/OUTBOX";
  assert.equal((await api(badId)).statusCode, 400);
});

test("concurrent or expired lead updates return conflict instead of reporting success", async () => {
  const api = createApiHandler({
    leadWriter: { create: async () => "created" },
    leadIntake: { enabled: false, consentPolicyVersion: "", retentionDays: 0 },
    leadStatusWriter: { updateStatus: async () => { throw new LeadUpdateConflictError(); } },
  });
  const result = await api(statusRequest({ status: "CLOSED", expectedVersion: 0 }));
  assert.equal(result.statusCode, 409);
  assert.match(JSON.parse(result.body!).error, /Refresh/);
});

function statusRequest(body: unknown): Request {
  const event = request("/admin/leads/b9de9897-5f48-4a63-a872-1d1b53bd64a5", "PATCH", body);
  event.headers["content-type"] = "application/json";
  event.requestContext.authorizer = { jwt: { claims: { sub: "admin-1", "cognito:groups": ["ConsultingAdministrators"] } } };
  return event;
}

function validSubmission() {
  return {
    name: "Riley Example",
    email: "person@example.com",
    company: "",
    message: "I would like to discuss a project.",
    consent: true,
    consentPolicyVersion: "2026-01",
    website: "",
  };
}
