export const publicPaths = [
  "/",
  "/small-business",
  "/enterprise",
  "/work",
  "/services",
  "/services/digital-foundations",
  "/services/engineering-solutions",
  "/services/fractional-leadership",
  "/services/ai-automation",
  "/services/cloud-cost-optimization",
  "/approach",
  "/about",
  "/faq",
  "/contact",
];

export function publicRouteHtmlPath(path: string): string {
  if (!publicPaths.includes(path)) throw new Error(`Not an approved public route: ${path}`);
  return path === "/" ? "index.html" : `route-meta/${path.slice(1).replace(/\//g, "--")}.html`;
}

export const publicRouteFunctionCode = `
function handler(event) {
  var request = event.request;
  if (request.method !== "GET" && request.method !== "HEAD") return request;
  var uri = request.uri;
  if (uri.length > 1 && uri.charAt(uri.length - 1) === "/") uri = uri.slice(0, -1);
  if (${JSON.stringify(publicPaths)}.indexOf(uri) !== -1) {
    request.uri = uri === "/" ? "/index.html" : "/route-meta/" + uri.slice(1).replace(/\\//g, "--") + ".html";
  }
  return request;
}
`;
