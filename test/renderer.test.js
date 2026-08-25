import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promoteFigureSpec } from "../skills/figthread/runtime/validator.js";
import { promoteVisualSpec } from "../skills/figthread/runtime/visual.js";
import { promoteProfilePlan } from "../skills/figthread/runtime/profile.js";
import { promoteProfileLayout } from "../skills/figthread/runtime/visual-layout.js";
import { SUPPORTED_CORE_PRIMITIVES, auditRenderedSvg, promoteRenderedSvg, renderPromotedSvg } from "../skills/figthread/runtime/renderer.js";

const figure = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.figure.json", import.meta.url), "utf8"));
const visual = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.visual.json", import.meta.url), "utf8"));
const target = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.layout-target.json", import.meta.url), "utf8"));
const registry = JSON.parse(await readFile(new URL("../skills/figthread/primitives/registry.json", import.meta.url), "utf8"));
const profiles = JSON.parse(await readFile(new URL("../skills/figthread/profiles/registry.json", import.meta.url), "utf8"));

function chain(figureDoc = figure, visualDoc = visual, targetDoc = target) {
  const fig = promoteFigureSpec(figureDoc);
  assert.equal(fig.promoted, true);
  const vis = promoteVisualSpec(fig, visualDoc);
  assert.equal(vis.promoted, true);
  const profile = promoteProfilePlan(fig, vis, targetDoc);
  assert.equal(profile.promoted, true);
  const layout = promoteProfileLayout(fig, vis, profile);
  assert.equal(layout.promoted, true);
  return { fig, vis, profile, layout };
}

test("renderer covers every bundled core primitive family", () => {
  assert.deepEqual([...SUPPORTED_CORE_PRIMITIVES].sort(), registry.definitions.map((entry) => entry.id).sort());
});

test("promoted SVG is deterministic and bound to upstream hashes", () => {
  const inputs = chain();
  const a = promoteRenderedSvg(inputs.fig, inputs.vis, inputs.profile, inputs.layout);
  const b = promoteRenderedSvg(inputs.fig, inputs.vis, inputs.profile, inputs.layout);
  assert.equal(a.promoted, true);
  assert.equal(a.rendered_svg.svg_hash, b.rendered_svg.svg_hash);
  assert.equal(a.rendered_svg.render_hash, b.rendered_svg.render_hash);
  assert.equal(a.promotion_receipt.promotion_hash, b.promotion_receipt.promotion_hash);
  assert.equal(a.rendered_svg.layout_hash, inputs.layout.resolved_layout.layout_hash);
  assert.equal(Object.isFrozen(a.rendered_svg), true);
});

test("rendered SVG uses resolved geometry, semantic summary state, and standalone markup", () => {
  const inputs = chain();
  const result = renderPromotedSvg(inputs.fig, inputs.vis, inputs.profile, inputs.layout);
  assert.notEqual(result.status, "fail");
  const svg = result.rendered_svg.svg;
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 800 300"/);
  assert.match(svg, /data-node-id="node:input"/);
  assert.match(svg, /data-node-id="node:queue"/);
  assert.match(svg, /data-relation-id="relation:queue-output"/);
  assert.match(svg, /data-state-mark="occupancy"/);
  assert.doesNotMatch(svg, /<script\b/i);
  assert.doesNotMatch(svg, /<foreignObject\b/i);
  assert.doesNotMatch(svg, /(?:href|xlink:href)="https?:/i);
});

test("technical explainer render evidence proves emitted font, stroke, and contrast floors", () => {
  const inputs = chain();
  const result = renderPromotedSvg(inputs.fig, inputs.vis, inputs.profile, inputs.layout);
  assert.notEqual(result.status, "fail");
  const observed = result.rendered_svg.evidence.observed;
  assert.ok(observed.primary_font_floor_px >= 15);
  assert.ok(observed.essential_stroke_floor_px >= 1.5);
  assert.ok(observed.text_contrast_min >= 4.5);
  assert.ok(observed.essential_mark_contrast_min >= 3);
  assert.equal(observed.external_reference_count, 0);
  assert.equal(observed.browser_text_extent_certified, false);
});

test("paper renderer emits grayscale-only proof", () => {
  const paperFigure = structuredClone(figure);
  paperFigure.profile = "paper";
  const paperTarget = structuredClone(target);
  paperTarget.target.profile = "paper";
  const inputs = chain(paperFigure, visual, paperTarget);
  const result = renderPromotedSvg(inputs.fig, inputs.vis, inputs.profile, inputs.layout);
  assert.notEqual(result.status, "fail");
  assert.equal(result.rendered_svg.evidence.observed.grayscale, true);
  for (const color of result.rendered_svg.evidence.observed.colors) assert.match(color, /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i);
});

test("tampered promoted layout is rejected before rendering", () => {
  const inputs = chain();
  const tampered = structuredClone(inputs.layout);
  tampered.resolved_layout.boxes["node:queue"].x += 1;
  const result = renderPromotedSvg(inputs.fig, inputs.vis, inputs.profile, tampered);
  assert.equal(result.status, "fail");
  assert.ok(result.issues.some((entry) => entry.code === "RND001_BIND"));
});

test("render audit fails profile floors on deliberately weakened SVG", () => {
  const threshold = profiles.definitions.find((entry) => entry.id === "technical-explainer");
  const svg = '<svg><rect fill="#fbfaf6"/><rect stroke="#1f2328" stroke-width="0.5" data-essential="true"/><text font-size="8" fill="#1f2328">x</text></svg>';
  const audit = auditRenderedSvg(svg, threshold, { paper: "#fbfaf6" });
  assert.equal(audit.status, "fail");
  assert.ok(audit.issues.some((entry) => entry.code === "RND004_TYPE"));
  assert.ok(audit.issues.some((entry) => entry.code === "RND005_STROKE"));
});
