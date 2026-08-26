import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("visual audit runtime, schema, and custom fixture mirrors stay byte-identical", async () => {
  const [skillRuntime, rootRuntime, skillSchema, rootSchema, skillExample, rootExample] = await Promise.all([
    read("../skills/figthread/runtime/visual-audit.js"),
    read("../src/visual-audit.js"),
    read("../skills/figthread/schemas/visual-audit-evidence.schema.json"),
    read("../schemas/visual-audit-evidence.schema.json"),
    read("../skills/figthread/examples/visual-audit-custom.visual.json"),
    read("../examples/visual-audit-custom.visual.json")
  ]);
  assert.equal(skillRuntime, rootRuntime);
  assert.equal(skillSchema, rootSchema);
  assert.equal(skillExample, rootExample);
  const parsed = JSON.parse(skillExample);
  assert.ok(parsed.custom_definitions.length > 0);
  assert.match(parsed.custom_definitions[0].local_svg, /data-figthread-audit=/);
  assert.match(parsed.custom_definitions[0].local_svg, /<text\b/);
});
