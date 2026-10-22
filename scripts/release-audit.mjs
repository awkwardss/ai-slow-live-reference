import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const ignoredDirectories = new Set([".git", "node_modules", "coverage"]);
const ignoredFiles = new Set(["scripts/release-audit.mjs"]);
const textExtensions = new Set(["", ".css", ".html", ".js", ".json", ".md", ".mjs", ".txt", ".yml", ".yaml"]);

const checks = [
  ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ["credential-looking assignment", /(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][A-Za-z0-9_./+-]{16,}["']/iu],
  ["absolute Windows user path", /[A-Z]:\\Users\\[^\\\s]+\\/iu],
  ["absolute Unix home path", /\/home\/[A-Za-z0-9._-]+\//u],
];

async function walk(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

const violations = [];
for (const path of await walk(root)) {
  const name = relative(root, path).replaceAll("\\", "/");
  if (ignoredFiles.has(name) || !textExtensions.has(extname(path))) continue;
  const text = await readFile(path, "utf8");
  for (const [label, pattern] of checks) {
    if (pattern.test(text)) violations.push(`${name}: ${label}`);
  }
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (Object.keys(packageJson.dependencies ?? {}).length > 0) {
  violations.push("package.json: unexpected runtime dependencies");
}

if (violations.length > 0) {
  process.stderr.write(`Release audit failed:\n${violations.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Release audit passed: no credential patterns, private absolute paths, or runtime dependencies found.\n");
}
