import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import test from "node:test";

const skillRoot = new URL("../skills/figthread/", import.meta.url);
const textExtensions = new Set([".md", ".json", ".yaml", ".yml", ".js", ".mjs", ".svg"]);
const internalRoadmapCode = /\bD-\d{3}\b/g;
const publicContractVersionLabel = /\b(?:FigureSpec|VisualSpec|PrimitiveDefinition|PrimitivePlan|ProfilePlan|MotionSpec|LayoutIntent|ResolvedLayout|LayoutRequest|LayoutTarget|MotionProgram)\s+v?\d+\.\d+\b/g;

async function collectTextFiles(directoryUrl, files = []) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    if (entry.isDirectory()) await collectTextFiles(child, files);
    else if (textExtensions.has(extname(entry.name))) files.push(child);
  }
  return files;
}

test("installed skill contains no internal roadmap codes", async () => {
  const offenders = [];
  for (const file of await collectTextFiles(skillRoot)) {
    const content = await readFile(file, "utf8");
    const matches = [...content.matchAll(internalRoadmapCode)].map((match) => match[0]);
    if (matches.length) offenders.push({ file: relative(new URL("..", skillRoot).pathname, file.pathname), matches });
  }
  assert.deepEqual(offenders, []);
});

test("agent-facing prose omits contract version labels", async () => {
  const offenders = [];
  for (const file of await collectTextFiles(skillRoot)) {
    if (extname(file.pathname) !== ".md") continue;
    const content = await readFile(file, "utf8");
    const matches = [...content.matchAll(publicContractVersionLabel)].map((match) => match[0]);
    if (matches.length) offenders.push({ file: relative(new URL("..", skillRoot).pathname, file.pathname), matches });
  }
  assert.deepEqual(offenders, []);
});
