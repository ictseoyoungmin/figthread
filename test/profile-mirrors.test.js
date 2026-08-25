import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pairs = [
  ["../schemas/profile-plan.schema.json", "../skills/figthread/schemas/profile-plan.schema.json"],
  ["../profiles/registry.json", "../skills/figthread/profiles/registry.json"]
];

test("profile registry and schema mirrors remain byte-identical to installable skill sources", async () => {
  for (const [rootPath, skillPath] of pairs) {
    const [root, skill] = await Promise.all([
      readFile(new URL(rootPath, import.meta.url), "utf8"),
      readFile(new URL(skillPath, import.meta.url), "utf8")
    ]);
    assert.equal(root, skill, `${rootPath} drifted from ${skillPath}`);
  }
});
