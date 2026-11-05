import assert from "node:assert/strict";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { configuration } from "./config.ts";
import { ApplicationStack } from "./stack.ts";

test("offline development foundation is isolated, private, JWT-protected and free of costly network resources", () => {
  const template = Template.fromStack(new ApplicationStack(new App(), configuration("development", "123456789012")));
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "rct-consulting-development-core", BillingMode: "PAY_PER_REQUEST",
  });
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
    },
  });
  template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
  template.resourceCountIs("AWS::Route53::RecordSet", 0);
  template.resourceCountIs("AWS::CertificateManager::Certificate", 0);
  for (const type of ["AWS::EC2::VPC", "AWS::EC2::NatGateway", "AWS::RDS::DBCluster", "AWS::Events::EventBus"]) {
    template.resourceCountIs(type, 0);
  }
  template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
    RouteKey: "GET /me", AuthorizationType: "JWT", AuthorizerId: Match.anyValue(),
  });
  template.resourceCountIs("AWS::ApiGatewayV2::Route", 2);
  template.hasResourceProperties("AWS::Cognito::UserPool", {
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: true }, MfaConfiguration: "ON",
  });
  const policies = JSON.stringify(template.findResources("AWS::IAM::Policy"));
  assert.doesNotMatch(policies, /dynamodb:|events:|sts:AssumeRole|"Resource":"\*"/);
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
