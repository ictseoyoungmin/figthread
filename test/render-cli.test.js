import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("../skills/figthread/scripts/render.mjs", import.meta.url);
const figure = new URL("../skills/figthread/examples/minimal.figure.json", import.meta.url);
const visual = new URL("../skills/figthread/examples/minimal.visual.json", import.meta.url);
const target = new URL("../skills/figthread/examples/minimal.layout-target.json", import.meta.url);

test("render CLI writes standalone SVG and evidence after full promotion chain", async () => {
  const dir = await mkdtemp(join(tmpdir(), "figthread-render-"));
  const svgPath = join(dir, "figure.svg");
  const evidencePath = join(dir, "evidence.json");
  const result = spawnSync(process.execPath, [script.pathname, figure.pathname, visual.pathname, target.pathname, "--promote", "--out", svgPath, "--evidence", evidencePath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.promoted, true);
  assert.match(payload.rendered_svg.svg, /^\[written:/);
  const svg = await readFile(svgPath, "utf8");
  assert.match(svg, /data-figthread-root="true"/);
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  assert.equal(evidence.profile_id, "technical-explainer");
  assert.ok(evidence.observed.primary_font_floor_px >= 15);
});
