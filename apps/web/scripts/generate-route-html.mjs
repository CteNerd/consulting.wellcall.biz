import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { brand } from "../src/branding.ts";
import { presentation } from "../src/presentation.ts";
import { publicPageMetadata } from "../src/route-metadata.ts";

const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const routeDirectory = join(outputDirectory, "route-meta");
const config = presentation({ ...loadEnv("production", process.cwd(), "VITE_"), ...process.env });

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function replaceExactlyOnce(html, pattern, replacement, description) {
  if ((html.match(pattern) ?? []).length !== 1) throw new Error(`Expected one ${description} in the SPA shell`);
  return html.replace(pattern, replacement);
}

function replaceMeta(html, attribute, key, content) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta ${attribute}="${escapedKey}" content="[^"]*"\\s*/>`);
  return replaceExactlyOnce(
    html,
    pattern,
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`,
    `${attribute}=${key} metadata`,
  );
}

const shell = await readFile(join(outputDirectory, "index.html"), "utf8");
await mkdir(routeDirectory, { recursive: true });

for (const page of publicPageMetadata) {
  if (page.path === "/") continue;
  const title = `${brand.name} | ${page.title}${config.publicBrand ? "" : " | Development preview"}`;
  const fileName = `${page.path.slice(1).replaceAll("/", "--")}.html`;
  let html = replaceExactlyOnce(shell, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, "title");
  html = replaceMeta(html, "name", "description", page.description);
  if (config.origin) {
    const url = `${config.origin}${page.path}`;
    html = replaceExactlyOnce(
      html,
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${url}" />`,
      "canonical link",
    );
    html = replaceMeta(html, "property", "og:title", title);
    html = replaceMeta(html, "property", "og:description", page.description);
    html = replaceMeta(html, "property", "og:url", url);
    html = replaceMeta(html, "name", "twitter:title", title);
    html = replaceMeta(html, "name", "twitter:description", page.description);
  }
  await writeFile(join(routeDirectory, fileName), html);
}
