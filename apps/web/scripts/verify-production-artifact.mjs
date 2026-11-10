import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { presentation } from "../src/presentation.ts";

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
