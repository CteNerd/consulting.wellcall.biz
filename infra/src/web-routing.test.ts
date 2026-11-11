import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { publicRouteFunctionCode, publicRouteHtmlPath } from "./web-routing.ts";

type Request = { method: string; uri: string; querystring: Record<string, { value: string }> };
type Handler = (event: { request: Request }) => Request;

function route(uri: string, method = "GET", activatePublicRouteMetadata = false) {
  const context: { handler?: Handler } = {};
  runInNewContext(publicRouteFunctionCode(activatePublicRouteMetadata), context);
  assert.ok(context.handler);
  const request = { method, uri, querystring: { code: { value: "oauth-code" } } };
  const response = context.handler({ request });
  assert.equal(response, request);
  assert.deepEqual(response.querystring, { code: { value: "oauth-code" } });
  return response.uri;
}

test("public URLs retain the index-shell mapping until static route metadata is activated", () => {
  for (const path of [
    "/", "/small-business", "/enterprise", "/work", "/services", "/services/digital-foundations",
    "/services/engineering-solutions", "/services/fractional-leadership",
    "/services/ai-automation", "/services/cloud-cost-optimization", "/approach",
    "/about", "/faq", "/contact",
  ]) {
    assert.equal(route(path), "/index.html", path);
  }
});

test("activated public page URLs serve their metadata shells without losing OAuth query parameters", () => {
  for (const path of [
    "/", "/small-business", "/enterprise", "/work", "/services", "/services/digital-foundations",
    "/services/engineering-solutions", "/services/fractional-leadership",
    "/services/ai-automation", "/services/cloud-cost-optimization", "/approach",
    "/about", "/faq", "/contact",
  ]) {
    const expected = `/${publicRouteHtmlPath(path)}`;
    assert.equal(route(path, "GET", true), expected, path);
    assert.equal(route(path === "/" ? path : `${path}/`, "HEAD", true), expected, path);
  }
});

test("nested public routes map to flat metadata HTML paths", () => {
  assert.equal(publicRouteHtmlPath("/services/digital-foundations"), "route-meta/services--digital-foundations.html");
  assert.throws(() => publicRouteHtmlPath("/services/unknown"), /Not an approved public route/);
});

test("unknown paths and missing assets retain origin error behavior instead of receiving HTML", () => {
  for (const path of [
    "/missing", "/missing/", "/services/unknown", "/assets/missing.js", "/favicon.ico",
    "/api/health", "/admin", "/projects", "/services//", "/SERVICES", "/index.html",
  ]) assert.equal(route(path), path);
  assert.equal(route("/contact", "POST"), "/contact");
});
