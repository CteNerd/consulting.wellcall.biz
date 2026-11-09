import assert from "node:assert/strict";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { configuration } from "./config.ts";
import { ApplicationStack } from "./stack.ts";

test("development foundation keeps intake closed, protects API access and provisions a bounded outbox path", () => {
  const template = Template.fromStack(new ApplicationStack(new App(), configuration("development", "123456789012")));
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "rct-consulting-development-core",
    BillingMode: "PAY_PER_REQUEST",
    StreamSpecification: { StreamViewType: "NEW_IMAGE" },
    TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({ IndexName: "OutboxPendingIndex", Projection: { ProjectionType: "ALL" } }),
      Match.objectLike({
        IndexName: "LeadListingIndex",
        Projection: {
          ProjectionType: "INCLUDE",
          NonKeyAttributes: [
            "leadId", "name", "email", "company", "message", "createdAt",
            "consentedAt", "consentPolicyVersion", "status", "version", "expiresAt",
          ],
        },
      }),
      Match.objectLike({
        IndexName: "WorkspaceIndex",
        KeySchema: [
          { AttributeName: "GSI3PK", KeyType: "HASH" },
          { AttributeName: "GSI3SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      }),
    ]),
  });
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
    },
  });
  template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
  template.hasResourceProperties("AWS::CloudFront::Function", {
    AutoPublish: true,
    FunctionConfig: { Runtime: "cloudfront-js-2.0" },
  });
  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: {
      DefaultCacheBehavior: {
        FunctionAssociations: [{
          EventType: "viewer-request",
          FunctionARN: Match.anyValue(),
        }],
      },
      CustomErrorResponses: Match.absent(),
    },
  });
  template.resourceCountIs("AWS::Route53::RecordSet", 0);
  template.resourceCountIs("AWS::CertificateManager::Certificate", 0);
  for (const type of ["AWS::EC2::VPC", "AWS::EC2::NatGateway", "AWS::RDS::DBCluster", "AWS::Events::EventBus"]) {
    template.resourceCountIs(type, 0);
  }
  template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
    RouteKey: "GET /me", AuthorizationType: "JWT", AuthorizerId: Match.anyValue(),
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
    RouteKey: "GET /admin/leads", AuthorizationType: "JWT", AuthorizerId: Match.anyValue(),
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
    RouteKey: "PATCH /admin/leads/{leadId}", AuthorizationType: "JWT", AuthorizerId: Match.anyValue(),
  });
  for (const routeKey of [
    "GET /projects",
    "GET /projects/{projectId}/assignments",
    "POST /projects/{projectId}/assignments",
    "GET /projects/{projectId}/tasks",
    "POST /projects/{projectId}/tasks",
    "PATCH /projects/{projectId}/tasks/{taskId}",
    "GET /my/time-entries",
    "POST /projects/{projectId}/time-entries",
    "POST /projects/{projectId}/time-entries/{timeEntryId}/submit",
    "GET /projects/{projectId}/pending-time",
    "POST /projects/{projectId}/time-entries/{timeEntryId}/review",
  ]) {
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: routeKey, AuthorizationType: "JWT", AuthorizerId: Match.anyValue(),
    });
  }
  template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
    GroupName: "ConsultingAdministrators",
  });
  const [poolId] = Object.keys(template.findResources("AWS::Cognito::UserPool"));
  const [clientId] = Object.keys(template.findResources("AWS::Cognito::UserPoolClient"));
  assert.ok(poolId);
  assert.ok(clientId);
  const [userPoolClient] = Object.values(template.findResources("AWS::Cognito::UserPoolClient"));
  assert.ok(userPoolClient);
  assert.deepEqual(userPoolClient.Properties.CallbackURLs, userPoolClient.Properties.LogoutURLs);
  template.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
    AuthorizerType: "JWT",
    JwtConfiguration: {
      Issuer: { "Fn::GetAtt": [poolId, "ProviderURL"] },
      Audience: [{ Ref: clientId }],
    },
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
    RouteKey: "POST /leads", AuthorizationType: "NONE",
  });
  template.resourceCountIs("AWS::ApiGatewayV2::Route", 16);
  template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
    StageName: "$default",
    DefaultRouteSettings: { ThrottlingBurstLimit: 10, ThrottlingRateLimit: 5 },
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
    CorsConfiguration: Match.objectLike({
      AllowOrigins: Match.arrayWith(["http://127.0.0.1:5173"]),
      AllowHeaders: Match.arrayWith(["idempotency-key"]),
      AllowMethods: Match.arrayWith(["POST", "PATCH"]),
    }),
  });
  template.hasResourceProperties("AWS::Cognito::UserPool", {
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: true }, MfaConfiguration: "ON",
  });
  const policies = JSON.stringify(template.findResources("AWS::IAM::Policy"));
  assert.match(policies, /dynamodb:GetItem/);
  assert.doesNotMatch(policies, /dynamodb:TransactWriteItems/);
  const [tableId] = Object.keys(template.findResources("AWS::DynamoDB::Table"));
  assert.ok(tableId);
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith([Match.objectLike({
        Action: "dynamodb:PutItem",
        Resource: { "Fn::GetAtt": [tableId, "Arn"] },
        Condition: {
          "ForAnyValue:StringEquals": { "dynamodb:EnclosingOperation": ["TransactWriteItems"] },
          "ForAllValues:StringLike": {
            "dynamodb:LeadingKeys": ["LEAD#*", "IDEMPOTENCY#*", "OUTBOX#*", "PROJECT#*"],
          },
          Null: { "dynamodb:LeadingKeys": "false" },
        },
      })]),
    },
  });
  assert.match(policies, /dynamodb:UpdateItem/);
  assert.match(policies, /dynamodb:Query/);
  assert.match(policies, /index\/LeadListingIndex/);
  assert.match(policies, /index\/WorkspaceIndex/);
  assert.match(policies, /index\/OutboxPendingIndex/);
  assert.match(policies, /dynamodb:ConditionCheckItem/);
  assert.match(policies, /"dynamodb:LeadingKeys":\["PROJECT#\*"\]/);
  assert.doesNotMatch(policies, /dynamodb:LeadingKeys[^}]*FINANCE|dynamodb:LeadingKeys[^}]*RATE/);
  assert.match(policies, /"ForAllValues:StringLike":\{"dynamodb:LeadingKeys":\["LEAD#\*"\]\}/);
  assert.match(policies, /events:PutEvents/);
  assert.equal((policies.match(/events:PutEvents/g) ?? []).length, 1);
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith([Match.objectLike({
        Action: "events:PutEvents",
        Condition: {
          StringEquals: {
            "events:source": "rct.consulting",
            "events:detail-type": "consulting.lead.created.v1",
          },
        },
      })]),
    },
  });
  assert.match(policies, /"Action":"dynamodb:ListStreams","Effect":"Allow","Resource":"\*"/);
  assert.equal((policies.match(/"Resource":"\*"/g) ?? []).length, 1);
  assert.doesNotMatch(policies, /dynamodb:Scan|dynamodb:DeleteItem|sts:AssumeRole/);
  template.hasResourceProperties("AWS::Events::Rule", { ScheduleExpression: "rate(5 minutes)" });
  template.hasResourceProperties("AWS::SQS::Queue", {
    QueueName: "rct-consulting-development-outbox-publisher-failures",
    MessageRetentionPeriod: 1209600,
  });
  template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
    BatchSize: 10,
    MaximumRetryAttempts: 5,
    MaximumRecordAgeInSeconds: 86400,
    FunctionResponseTypes: ["ReportBatchItemFailures"],
  });
  const mapping = JSON.stringify(template.findResources("AWS::Lambda::EventSourceMapping"));
  assert.match(mapping, /FilterCriteria/);
  assert.match(mapping, /OUTBOX/);
  template.hasParameter("LeadIntakeEnabled", { Default: "false", AllowedValues: ["false", "true"] });
  template.hasParameter("LeadConsentPolicyVersion", { Default: "" });
  template.hasParameter("LeadRetentionDays", { Default: 0 });
  assert.match(policies, /logs:PutLogEvents/);
});

test("production data is retained, backed up and protected from deletion", () => {
  const template = Template.fromStack(new ApplicationStack(new App(), configuration("production", "123456789012")));
  template.hasResource("AWS::DynamoDB::Table", {
    DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain",
    Properties: Match.objectLike({
      TableName: "rct-consulting-production-core", DeletionProtectionEnabled: true,
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    }),
  });
  template.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Retain" });
  template.resourceCountIs("AWS::Cognito::UserPoolDomain", 0);
  template.resourceCountIs("AWS::IAM::ManagedPolicy", 0);
});

test("development web publisher has exact OIDC trust and a matching artifact-only permissions boundary", () => {
  const template = Template.fromStack(new ApplicationStack(new App(), configuration("development", "123456789012")));
  template.resourceCountIs("AWS::IAM::OIDCProvider", 0);
  template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
    Domain: "rct-consulting-development-123456789012",
  });
  const publisher = Object.values(template.findResources("AWS::IAM::Role")).find((role) =>
    role.Properties.RoleName === "rct-consulting-development-web-publish");
  assert.ok(publisher);
  assert.deepEqual(publisher.Properties.PermissionsBoundary, publisher.Properties.ManagedPolicyArns[0]);
  assert.deepEqual(publisher.Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals, {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:CteNerd/consulting.wellcall.biz:environment:development",
  });
  const policies = JSON.stringify(template.findResources("AWS::IAM::ManagedPolicy"));
  const [bucketId] = Object.keys(template.findResources("AWS::S3::Bucket"));
  assert.ok(bucketId);
  template.hasResourceProperties("AWS::IAM::ManagedPolicy", {
    PolicyDocument: {
      Statement: Match.arrayWith([Match.objectLike({
        Action: ["s3:GetBucketLocation", "s3:GetBucketPublicAccessBlock", "s3:GetBucketPolicyStatus", "s3:ListBucket"],
        Resource: { "Fn::GetAtt": [bucketId, "Arn"] },
      })]),
    },
  });
  assert.match(policies, /s3:PutObject/);
  assert.match(policies, /assets\/\*|index\.html/);
  assert.match(policies, /cloudfront:CreateInvalidation/);
  assert.match(policies, /cloudformation:DescribeStacks/);
  assert.doesNotMatch(policies, /DeleteObject|PutBucket|UpdateDistribution|CreateStack|ExecuteChangeSet|iam:|dynamodb:|"Resource":"\*"/);
});

test("custom DNS reuses only the existing zone and production requires explicit clearance", () => {
  const config = configuration("production", "123456789012");
  assert.throws(() => new ApplicationStack(new App(), config, true), /approval/);
  const template = Template.fromStack(new ApplicationStack(new App(), config, true, true));
  template.resourceCountIs("AWS::Route53::HostedZone", 0);
  template.hasResourceProperties("AWS::CertificateManager::Certificate", {
    DomainName: "thirddowntech.com", SubjectAlternativeNames: ["api.thirddowntech.com"],
    DomainValidationOptions: Match.arrayWith([Match.objectLike({ HostedZoneId: config.hostedZoneId })]),
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", { DomainName: "api.thirddowntech.com" });
  template.resourceCountIs("AWS::Route53::RecordSet", 3);
});

test("invalid environment/account never silently falls back to production", () => {
  assert.throws(() => configuration(undefined, "123456789012"), /environment/);
  assert.throws(() => configuration("development", undefined), /account/);
  assert.throws(() => configuration("production", "123"), /account/);
});
