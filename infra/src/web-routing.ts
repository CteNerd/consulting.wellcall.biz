const publicPaths = [
  "/",
  "/small-business",
  "/enterprise",
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

export const publicRouteFunctionCode = `
function handler(event) {
  var request = event.request;
  if (request.method !== "GET" && request.method !== "HEAD") return request;
  var uri = request.uri;
  if (uri.length > 1 && uri.charAt(uri.length - 1) === "/") uri = uri.slice(0, -1);
  if (${JSON.stringify(publicPaths)}.indexOf(uri) !== -1) request.uri = "/index.html";
  return request;
}
`;
