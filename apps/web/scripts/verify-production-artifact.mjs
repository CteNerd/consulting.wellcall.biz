import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { brand } from "../src/branding.ts";
import { presentation } from "../src/presentation.ts";
import { publicPageMetadata } from "../src/route-metadata.ts";

const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url));

async function collectTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTextFiles(path);
    return entry.isFile() && /\.(?:html|js|css)$/.test(entry.name) ? [path] : [];
  }))).flat();
}

const textFiles = await collectTextFiles(outputDirectory);
const contents = await Promise.all(textFiles.map((path) => readFile(path, "utf8")));
const artifact = contents.join("\n");
const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
for (const marker of [
  "uat-manager",
  "uat-contributor",
  "uat-admin",
  "uat-unassigned",
  "7e3dd6a8-6074-42c0-9e83-f2917de26d44",
  "Map a real team workflow",
  "Switch synthetic role",
  "NOT REAL AUTH · NOT DYNAMODB · NOT A LIVE SERVICE",
]) {
  assert.equal(artifact.includes(marker), false, `Production artifact contains UAT fixture marker: ${marker}`);
}

const config = presentation({ ...loadEnv("production", process.cwd(), "VITE_"), ...process.env });
const html = await readFile(join(outputDirectory, "index.html"), "utf8");
const expectedRouteFiles = publicPageMetadata
  .filter((page) => page.path !== "/")
  .map((page) => `${page.path.slice(1).replaceAll("/", "--")}.html`)
  .sort();
const actualRouteFiles = (await readdir(join(outputDirectory, "route-meta"))).sort();
assert.deepEqual(actualRouteFiles, expectedRouteFiles, "Generated route HTML must match the public route inventory");

const routeUrls = new Set();
for (const page of publicPageMetadata.filter((item) => item.path !== "/")) {
  const routeFile = `${page.path.slice(1).replaceAll("/", "--")}.html`;
  const routeHtml = await readFile(join(outputDirectory, "route-meta", routeFile), "utf8");
  const title = `${brand.name} | ${page.title}${config.publicBrand ? "" : " | Development preview"}`;
  assert.ok(routeHtml.includes(`<title>${escapeHtml(title)}</title>`), `Route title missing for ${page.path}`);
  assert.ok(
    routeHtml.includes(`<meta name="description" content="${escapeHtml(page.description)}" />`),
    `Route description missing for ${page.path}`,
  );
  if (config.origin) {
    const url = `${config.origin}${page.path}`;
    assert.ok(routeHtml.includes(`<link rel="canonical" href="${url}" />`), `Canonical URL missing for ${page.path}`);
    assert.ok(routeHtml.includes(`<meta property="og:title" content="${escapeHtml(title)}" />`), `Open Graph title missing for ${page.path}`);
    assert.ok(routeHtml.includes(`<meta property="og:description" content="${escapeHtml(page.description)}" />`), `Open Graph description missing for ${page.path}`);
    assert.ok(routeHtml.includes(`<meta property="og:url" content="${url}" />`), `Open Graph URL missing for ${page.path}`);
    assert.ok(routeHtml.includes(`<meta name="twitter:title" content="${escapeHtml(title)}" />`), `Twitter title missing for ${page.path}`);
    assert.ok(routeHtml.includes(`<meta name="twitter:description" content="${escapeHtml(page.description)}" />`), `Twitter description missing for ${page.path}`);
    routeUrls.add(url);
  } else {
    assert.ok(!routeHtml.includes("og:title") && !routeHtml.includes("twitter:title"), "Preview must not publish route social metadata");
  }
}
if (config.origin) assert.equal(routeUrls.size, expectedRouteFiles.length, "Every public route needs a unique social URL");

if (config.origin) {
  for (const tag of [
    `<meta property="og:image" content="${config.origin}/assets/third-down-social-8e2cf34fa2ac.jpg" />`,
    `<meta name="twitter:image" content="${config.origin}/assets/third-down-social-8e2cf34fa2ac.jpg" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
  ]) assert.ok(html.includes(tag), `Production social metadata missing: ${tag}`);
  const image = await readFile(join(outputDirectory, "assets/third-down-social-8e2cf34fa2ac.jpg"));
  assert.equal(image.readUInt16BE(0), 0xffd8, "Social preview must be a published JPEG");
} else {
  assert.ok(!html.includes("og:image") && !html.includes("twitter:image"), "Preview must not publish production social metadata");
}
