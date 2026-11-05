import assert from "node:assert/strict";
import { test } from "node:test";
import { handler, type Request } from "./handler.ts";

function request(path: string, method = "GET"): Request {
  return {
    version: "2.0", routeKey: `${method} ${path}`, rawPath: path,
    rawQueryString: "", headers: {}, isBase64Encoded: false,
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
