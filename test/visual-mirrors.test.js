import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pairs=[
  ["../schemas/visual-spec.schema.json","../skills/figthread/schemas/visual-spec.schema.json"],
  ["../schemas/primitive-definition.schema.json","../skills/figthread/schemas/primitive-definition.schema.json"],
  ["../schemas/primitive-plan.schema.json","../skills/figthread/schemas/primitive-plan.schema.json"],
  ["../schemas/layout-target.schema.json","../skills/figthread/schemas/layout-target.schema.json"],
  ["../examples/minimal.visual.json","../skills/figthread/examples/minimal.visual.json"],
  ["../examples/minimal.layout-target.json","../skills/figthread/examples/minimal.layout-target.json"]
];

test("visual schemas and examples remain byte-identical to installable skill sources",async()=>{for(const [rootPath,skillPath] of pairs){const [root,skill]=await Promise.all([readFile(new URL(rootPath,import.meta.url),"utf8"),readFile(new URL(skillPath,import.meta.url),"utf8")]);assert.equal(root,skill,`${rootPath} drifted from ${skillPath}`);}});
