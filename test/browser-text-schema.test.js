import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browser text evidence schema root mirror matches installed skill", async () => {
  const [installed, mirror] = await Promise.all([
    readFile(new URL("../skills/figthread/schemas/browser-text-evidence.schema.json", import.meta.url), "utf8"),
    readFile(new URL("../schemas/browser-text-evidence.schema.json", import.meta.url), "utf8")
  ]);
  assert.equal(installed, mirror);
});
