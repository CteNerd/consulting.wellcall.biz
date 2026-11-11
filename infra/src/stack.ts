import { CfnOutput, CfnParameter, CliCredentialsStackSynthesizer, Duration, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as events from "aws-cdk-lib/aws-events";
import * as eventTargets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as destinations from "aws-cdk-lib/aws-lambda-destinations";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { resolve } from "node:path";
import type { Configuration } from "./config.ts";
import { publicRouteFunctionCode } from "./web-routing.ts";

export class ApplicationStack extends Stack {
  constructor(
    scope: Construct,
    config: Configuration,
    customDomains = false,
    brandLaunchApproved = false,
    activatePublicRouteMetadata = false,
  ) {
    super(scope, `${config.prefix}-foundation`, {
      env: { account: config.account, region: config.region },
      synthesizer: new CliCredentialsStackSynthesizer({
        fileAssetsBucketName: config.releaseAssetsBucket,
        bucketPrefix: "release/",
      }),
    });
    if (customDomains && config.environment === "production" && !brandLaunchApproved) {
      throw new Error("Production custom domains require explicit brand/cutover approval");
    }
    Tags.of(this).add("Portfolio", "RCT");
    Tags.of(this).add("Application", "Consulting");
    Tags.of(this).add("Environment", config.environment);
    const production = config.environment === "production";
    const removalPolicy = production ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const core = new dynamodb.Table(this, "Core", {
      tableName: `${config.prefix}-core`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy,
      deletionProtection: production,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: production },
    });
    core.addGlobalSecondaryIndex({
      indexName: "OutboxPendingIndex",
      partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    core.addGlobalSecondaryIndex({
      indexName: "LeadListingIndex",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: [
        "leadId", "name", "email", "company", "message", "createdAt",
        "consentedAt", "consentPolicyVersion", "status", "version", "expiresAt",
      ],
    });
    core.addGlobalSecondaryIndex({
      indexName: "WorkspaceIndex",
      partitionKey: { name: "GSI3PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI3SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    const bucket = new s3.Bucket(this, "WebAssets", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const zone = customDomains && !config.existingDevCertificateArn ? route53.HostedZone.fromHostedZoneAttributes(this, "ExistingZone", {
      hostedZoneId: config.hostedZoneId, zoneName: config.hostedZoneName,
    }) : undefined;
    const certificate = config.existingDevCertificateArn
      ? acm.Certificate.fromCertificateArn(this, "ExistingDevelopmentCertificate", config.existingDevCertificateArn)
      : zone ? new acm.Certificate(this, "WebCertificate", {
      domainName: config.webDomain,
      subjectAlternativeNames: config.apiDomain ? [config.apiDomain] : [],
      validation: acm.CertificateValidation.fromDns(zone),
    }) : undefined;
    const publicRouting = new cloudfront.Function(this, "PublicPageRouting", {
      code: cloudfront.FunctionCode.fromInline(publicRouteFunctionCode(activatePublicRouteMetadata)),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: "Serve the public page shell only for approved Third Down routes",
    });
    const distribution = new cloudfront.Distribution(this, "Web", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: production ? cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS
          : new cloudfront.ResponseHeadersPolicy(this, "DevelopmentNoindex", {
            securityHeadersBehavior: {
              contentTypeOptions: { override: true },
              frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
              referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
              strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
              xssProtection: { protection: true, modeBlock: true, override: true },
            },
            customHeadersBehavior: { customHeaders: [{ header: "X-Robots-Tag", value: "noindex, nofollow", override: true }] },
          }),
        compress: true,
        functionAssociations: [{
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          function: publicRouting,
        }],
      },
      ...(certificate ? {
        domainNames: [config.webDomain], certificate,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      } : {}),
    });
    const webOrigin = certificate ? `https://${config.webDomain}` : `https://${distribution.distributionDomainName}`;
    if (zone) {
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      new route53.ARecord(this, "WebAlias", { zone, recordName: config.webDomain, target });
      new route53.AaaaRecord(this, "WebIpv6Alias", { zone, recordName: config.webDomain, target });
    }
    const pool = new cognito.UserPool(this, "Auth", {
      userPoolName: `${config.prefix}-users`, selfSignUpEnabled: false,
      signInAliases: { email: true }, mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: { minLength: 14, requireDigits: true, requireSymbols: true, requireLowercase: true, requireUppercase: true },
      removalPolicy,
    });
    pool.addGroup("ConsultingAdministrators", {
      groupName: "ConsultingAdministrators",
      description: "Users authorized to access the Consulting lead inbox.",
    });
    const client = pool.addClient("Browser", {
      generateSecret: false, preventUserExistenceErrors: true,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: [`${webOrigin}/`],
        logoutUrls: [`${webOrigin}/`],
      },
    });
    {
      const authDomain = pool.addDomain("DevelopmentLogin", {
        cognitoDomain: { domainPrefix: `${config.prefix}-${config.account}` },
      });
      new CfnOutput(this, "AuthUrl", { value: authDomain.baseUrl() });
      const publisherPolicy = new iam.ManagedPolicy(this, "WebPublishPolicy", {
        description: "Web artifacts only; no infrastructure, identity or application data mutations",
        statements: [
          new iam.PolicyStatement({
            actions: ["s3:GetBucketLocation", "s3:GetBucketPublicAccessBlock", "s3:GetBucketPolicyStatus", "s3:ListBucket"],
            resources: [bucket.bucketArn],
          }),
          new iam.PolicyStatement({
            actions: ["s3:GetObject", "s3:PutObject"],
            resources: [bucket.arnForObjects("assets/*"), bucket.arnForObjects("index.html"), bucket.arnForObjects("route-meta/*")],
          }),
          new iam.PolicyStatement({
            actions: ["cloudfront:GetDistribution", "cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
            resources: [distribution.distributionArn],
          }),
          new iam.PolicyStatement({
            actions: ["cloudformation:DescribeStacks"],
            resources: [this.stackId],
          }),
        ],
      });
      const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this, "ExistingWebGitHubProvider",
        `arn:${this.partition}:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
      );
      const publisherRole = new iam.Role(this, "WebPublisher", {
        roleName: `${config.prefix}-web-publish`,
        path: `/rct/consulting/${config.environment}/`,
        assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": `repo:CteNerd/consulting.wellcall.biz:environment:${config.environment}`,
          },
        }),
        managedPolicies: [publisherPolicy],
        permissionsBoundary: publisherPolicy,
        maxSessionDuration: Duration.hours(1),
      });
      new CfnOutput(this, "WebPublishRoleArn", { value: publisherRole.roleArn });
    }
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      logGroupName: `/rct/${config.prefix}/api`,
      retention: production ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy,
    });
    const role = new iam.Role(this, "ApiRole", { assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com") });
    logGroup.grantWrite(role);
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["LEAD#*", "IDEMPOTENCY#*", "USER#*", "PROJECT#*"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:PutItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAnyValue:StringEquals": { "dynamodb:EnclosingOperation": ["TransactWriteItems"] },
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": ["LEAD#*", "IDEMPOTENCY#*", "OUTBOX#*", "PROJECT#*"],
        },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [`${core.tableArn}/index/LeadListingIndex`],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [core.tableArn],
      conditions: {
        "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["PROJECT#*"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [`${core.tableArn}/index/WorkspaceIndex`],
      conditions: {
        "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["USER#*"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [`${core.tableArn}/index/OutboxPendingIndex`],
      conditions: {
        "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["PROJECT#*#PENDING_TIME"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:ConditionCheckItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAnyValue:StringEquals": { "dynamodb:EnclosingOperation": ["TransactWriteItems"] },
        "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["USER#*", "PROJECT#*"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [core.tableArn],
      conditions: { "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["LEAD#*"] } },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAnyValue:StringEquals": { "dynamodb:EnclosingOperation": ["TransactWriteItems"] },
        "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["PROJECT#*"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    const intakeEnabled = new CfnParameter(this, "LeadIntakeEnabled", {
      type: "String", default: "false", allowedValues: ["false", "true"],
      description: "Enable public lead intake only after consent and retention policy approval.",
    });
    const consentPolicyVersion = new CfnParameter(this, "LeadConsentPolicyVersion", {
      type: "String", default: "",
      description: "Approved consent policy version; leave blank to keep intake closed.",
    });
    const leadRetentionDays = new CfnParameter(this, "LeadRetentionDays", {
      type: "Number", default: 0, minValue: 0, maxValue: 3650,
      description: "Approved lead retention period in days; zero keeps intake closed.",
    });
    const handler = new NodejsFunction(this, "ApiHandler", {
      entry: resolve(import.meta.dirname, "../../apps/api/src/handler.ts"),
      depsLockFilePath: resolve(import.meta.dirname, "../../package-lock.json"),
      runtime: lambda.Runtime.NODEJS_24_X, handler: "handler",
      memorySize: 256, timeout: Duration.seconds(10), logGroup, role,
      environment: {
        CORE_TABLE_NAME: core.tableName,
        LEAD_INTAKE_ENABLED: intakeEnabled.valueAsString,
        LEAD_CONSENT_POLICY_VERSION: consentPolicyVersion.valueAsString,
        LEAD_RETENTION_DAYS: leadRetentionDays.valueAsString,
      },
      bundling: { minify: true, sourceMap: false },
    });
    const api = new apigateway.HttpApi(this, "Api", {
      apiName: `${config.prefix}-api`,
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: [webOrigin, ...(config.environment === "development" ? ["http://127.0.0.1:5173"] : [])],
        allowMethods: [apigateway.CorsHttpMethod.GET, apigateway.CorsHttpMethod.POST, apigateway.CorsHttpMethod.PATCH],
        allowHeaders: ["authorization", "content-type", "idempotency-key"],
      },
    });
    const apiStage = new apigateway.HttpStage(this, "ApiStage", {
      httpApi: api,
      stageName: "$default",
      autoDeploy: true,
      throttle: { rateLimit: 5, burstLimit: 10 },
    });
    const integration = new HttpLambdaIntegration("ApiIntegration", handler);
    api.addRoutes({ path: "/health", methods: [apigateway.HttpMethod.GET], integration });
    const jwtAuthorizer = new HttpJwtAuthorizer("Cognito", pool.userPoolProviderUrl, {
      jwtAudience: [client.userPoolClientId],
    });
    api.addRoutes({
      path: "/me", methods: [apigateway.HttpMethod.GET], integration, authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/admin/leads", methods: [apigateway.HttpMethod.GET], integration, authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/admin/leads/{leadId}", methods: [apigateway.HttpMethod.PATCH], integration, authorizer: jwtAuthorizer,
    });
    api.addRoutes({ path: "/leads", methods: [apigateway.HttpMethod.POST], integration });
    for (const [path, methods] of [
      ["/projects", [apigateway.HttpMethod.GET]],
      ["/projects/{projectId}/assignments", [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST]],
      ["/projects/{projectId}/tasks", [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST]],
      ["/projects/{projectId}/tasks/{taskId}", [apigateway.HttpMethod.PATCH]],
      ["/my/time-entries", [apigateway.HttpMethod.GET]],
      ["/projects/{projectId}/time-entries", [apigateway.HttpMethod.POST]],
      ["/projects/{projectId}/time-entries/{timeEntryId}", [apigateway.HttpMethod.PATCH]],
      ["/projects/{projectId}/time-entries/{timeEntryId}/submit", [apigateway.HttpMethod.POST]],
      ["/projects/{projectId}/pending-time", [apigateway.HttpMethod.GET]],
      ["/projects/{projectId}/time-entries/{timeEntryId}/review", [apigateway.HttpMethod.POST]],
    ] as const) {
      api.addRoutes({ path, methods: [...methods], integration, authorizer: jwtAuthorizer });
    }
    if (zone && certificate && config.apiDomain) {
      const domain = new apigateway.DomainName(this, "ApiDomain", { domainName: config.apiDomain, certificate });
      new apigateway.ApiMapping(this, "ApiMapping", { api, domainName: domain, stage: apiStage });
      new route53.ARecord(this, "ApiAlias", {
        zone, recordName: config.apiDomain,
        target: route53.RecordTarget.fromAlias(new targets.ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId)),
      });
    }
    new CfnOutput(this, "WebUrl", { value: webOrigin });
    new CfnOutput(this, "WebBucket", { value: bucket.bucketName });
    new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "UserPoolId", { value: pool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: client.userPoolClientId });

    const busArn = ssm.StringParameter.valueForStringParameter(
      this, `/rct/${config.environment}/portfolio/event-bus-arn`,
    );
    const bus = events.EventBus.fromEventBusArn(this, "PortfolioEventBus", busArn);
    const publisherLogGroup = new logs.LogGroup(this, "OutboxPublisherLogs", {
      logGroupName: `/rct/${config.prefix}/outbox-publisher`,
      retention: production ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy,
    });
    const publisherRole = new iam.Role(this, "OutboxPublisherRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    publisherLogGroup.grantWrite(publisherRole);
    core.grantStreamRead(publisherRole);
    publisherRole.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [core.tableArn],
    }));
    publisherRole.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [`${core.tableArn}/index/OutboxPendingIndex`],
    }));
    const publisher = new NodejsFunction(this, "OutboxPublisher", {
      entry: resolve(import.meta.dirname, "../../apps/api/src/outbox-publisher.ts"),
      depsLockFilePath: resolve(import.meta.dirname, "../../package-lock.json"),
      runtime: lambda.Runtime.NODEJS_24_X, handler: "handler",
      memorySize: 256, timeout: Duration.seconds(30), logGroup: publisherLogGroup, role: publisherRole,
      environment: { CORE_TABLE_NAME: core.tableName, EVENT_BUS_ARN: bus.eventBusArn },
      bundling: { minify: true, sourceMap: false },
    });
    publisherRole.addToPolicy(new iam.PolicyStatement({
      actions: ["events:PutEvents"],
      resources: [bus.eventBusArn],
      conditions: {
        StringEquals: {
          "events:source": "rct.consulting",
          "events:detail-type": "consulting.lead.created.v1",
        },
      },
    }));
    const publisherFailures = new sqs.Queue(this, "OutboxPublisherFailures", {
      queueName: `${config.prefix}-outbox-publisher-failures`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
      removalPolicy,
    });
    publisher.addEventSource(new eventSources.DynamoEventSource(core, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 10,
      bisectBatchOnError: true,
      retryAttempts: 5,
      maxRecordAge: Duration.hours(24),
      reportBatchItemFailures: true,
      filters: [lambda.FilterCriteria.filter({
        eventName: ["INSERT"],
        dynamodb: { NewImage: { recordType: { S: ["OUTBOX"] } } },
      })],
      onFailure: new destinations.SqsDestination(publisherFailures),
    }));
    new events.Rule(this, "OutboxReconciliation", {
      schedule: events.Schedule.rate(Duration.minutes(5)),
      targets: [new eventTargets.LambdaFunction(publisher)],
    });
  }
}
