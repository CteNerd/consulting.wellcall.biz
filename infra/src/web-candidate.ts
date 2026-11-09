import { createHash } from "node:crypto";
import { appendFileSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const repository = "CteNerd/consulting.wellcall.biz";

function candidateFiles(directory: string, prefix = ""): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(join(directory, prefix)).sort()) {
    const path = `${prefix}${name}`;
    if (path === "manifest.json") continue;
    const entry = lstatSync(join(directory, path));
    if (entry.isDirectory() && path === "assets") {
      Object.assign(files, candidateFiles(directory, "assets/"));
    } else if (entry.isFile() && /^(?:index\.html|assets\/[a-zA-Z0-9_-]+\.(?:js|css))$/.test(path)) {
      files[path] = digest(readFileSync(join(directory, path)));
    } else {
      throw new Error(`Unexpected candidate path: ${path}`);
    }
  }
  if (!prefix && (!files["index.html"] || Object.keys(files).length < 2)) throw new Error("Candidate is incomplete");
  return files;
}

export function createCandidate(directory: string, sourceSha: string, runId: string): string {
  if (!/^[a-f0-9]{40}$/.test(sourceSha) || !/^[1-9][0-9]*$/.test(runId)) throw new Error("Invalid candidate provenance");
  const manifest = JSON.stringify({
    schema: 1, repository, sourceSha, runId, presentation: "production",
    intake: "closed", auth: "unconfigured", files: candidateFiles(directory),
  }, null, 2) + "\n";
  writeFileSync(join(directory, "manifest.json"), manifest, { flag: "wx" });
  return digest(manifest);
}

export function verifyCandidate(directory: string, expectedDigest: string, sourceSha: string, runId: string): void {
  const manifestPath = join(directory, "manifest.json");
  if (!lstatSync(manifestPath).isFile() || lstatSync(manifestPath).isSymbolicLink()) throw new Error("Unsafe manifest");
  const manifest = readFileSync(manifestPath, "utf8");
  if (!/^[a-f0-9]{64}$/.test(expectedDigest) || digest(manifest) !== expectedDigest) throw new Error("Manifest digest mismatch");
  const value = JSON.parse(manifest) as Record<string, unknown>;
  if (value.schema !== 1 || value.repository !== repository || value.sourceSha !== sourceSha || value.runId !== runId
    || value.presentation !== "production" || value.intake !== "closed" || value.auth !== "unconfigured"
    || JSON.stringify(value.files) !== JSON.stringify(candidateFiles(directory))) {
    throw new Error("Candidate bytes or provenance mismatch");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [operation, directory, sourceSha, runId, expectedDigest] = process.argv.slice(2);
  if (!directory || !sourceSha || !runId) throw new Error("Candidate directory, SHA and run ID are required");
  if (operation === "create") {
    const hash = createCandidate(directory, sourceSha, runId);
    if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
    appendFileSync(process.env.GITHUB_OUTPUT, `manifest_sha256=${hash}\n`);
  } else if (operation === "verify" && expectedDigest) {
    verifyCandidate(directory, expectedDigest, sourceSha, runId);
  } else throw new Error("Expected create or verify operation");
}
