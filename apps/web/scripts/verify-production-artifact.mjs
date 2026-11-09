import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
