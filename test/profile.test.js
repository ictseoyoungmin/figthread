import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promoteFigureSpec } from "../skills/figthread/runtime/validator.js";
import { promoteVisualSpec } from "../skills/figthread/runtime/visual.js";
import { PROFILE_REGISTRY_HASH, compileProfilePlan, promoteProfilePlan, validateProfileMotion } from "../skills/figthread/runtime/profile.js";
import { promoteProfileLayout } from "../skills/figthread/runtime/visual-layout.js";

const figure = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.figure.json", import.meta.url), "utf8"));
const visual = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.visual.json", import.meta.url), "utf8"));
const target = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.layout-target.json", import.meta.url), "utf8"));
const motion = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.motion.json", import.meta.url), "utf8"));

function promoteFigure(doc = figure) {
  const result = promoteFigureSpec(doc);
  assert.equal(result.promoted, true);
  return result;
}
function promoteVisual(figPromotion, doc = visual) {
  const result = promoteVisualSpec(figPromotion, doc);
  assert.equal(result.promoted, true);
  return result;
}
function has(report, code) {
  return report.issues.some((entry) => entry.code === code);
}

test("profile registry identity is content-hashed and stable", async () => {
  assert.match(PROFILE_REGISTRY_HASH, /^sha256:[0-9a-f]{64}$/);
  const registry = JSON.parse(await readFile(new URL("../skills/figthread/profiles/registry.json", import.meta.url), "utf8"));
  assert.equal(registry.registry_hash, PROFILE_REGISTRY_HASH);
  assert.deepEqual(registry.definitions.map((entry) => entry.id), ["paper", "paper-animated", "presentation", "technical-explainer", "infographic"]);
});

test("profile promotion is stable, immutable, and owns effective measurements", () => {
  const fig = promoteFigure();
  const vis = promoteVisual(fig);
  const a = promoteProfilePlan(fig, vis, target);
  const b = promoteProfilePlan(fig, vis, target);
  assert.equal(a.promoted, true);
  assert.equal(a.promotion_receipt.promotion_hash, b.promotion_receipt.promotion_hash);
  assert.equal(a.profile_plan.plan_hash, b.profile_plan.plan_hash);
  assert.equal(a.profile_plan.profile_id, "technical-explainer");
  assert.equal(a.profile_plan.options.min_gap, 18);
  assert.equal(Object.isFrozen(a.profile_plan), true);
  assert.equal(Object.isFrozen(a.promotion_receipt), true);
});

test("profile spacing floors strengthen underspecified targets without weakening primitives", () => {
  const fig = promoteFigure();
  const vis = promoteVisual(fig);
  const cramped = structuredClone(target);
  cramped.options.min_gap = 4;
  cramped.options.preferred_gap = 10;
  const result = compileProfilePlan(fig, vis, cramped);
  assert.notEqual(result.status, "fail");
  assert.equal(result.profile_plan.options.min_gap, 18);
  assert.equal(result.profile_plan.options.preferred_gap, 18);
  assert.ok(result.profile_plan.adjustments.some((entry) => entry.kind === "spacing-floor"));
  for (const metric of result.profile_plan.measurements) {
    const primitive = vis.primitive_plan.measurements.find((entry) => entry.node_id === metric.node_id);
    assert.ok(metric.min_w >= primitive.min_w);
    assert.ok(metric.min_h >= primitive.min_h);
  }
});

test("profile text floors deterministically enlarge long labels", () => {
  const longFigure = structuredClone(figure);
  longFigure.nodes.find((node) => node.id === "node:input").label = "A deliberately long explanatory input label";
  const fig = promoteFigure(longFigure);
  const vis = promoteVisual(fig);
  const result = compileProfilePlan(fig, vis, target);
  assert.notEqual(result.status, "fail");
  const base = vis.primitive_plan.measurements.find((entry) => entry.node_id === "node:input");
  const refined = result.profile_plan.measurements.find((entry) => entry.node_id === "node:input");
  assert.ok(refined.min_w > base.min_w);
  assert.ok(result.profile_plan.adjustments.some((entry) => entry.kind === "text-floor" && entry.node_id === "node:input"));
});

test("hard semantic density ceiling fails the profile gate", () => {
  const denseFigure = structuredClone(figure);
  const denseVisual = structuredClone(visual);
  const templateNode = denseFigure.nodes.find((node) => node.id === "node:input");
  const templateBinding = denseVisual.bindings.find((binding) => binding.node_id === "node:input");
  for (let i = 0; i < 28; i += 1) {
    const nodeId = `node:extra-${i}`;
    denseFigure.nodes.push({ ...structuredClone(templateNode), id: nodeId, label: `Extra ${i}`, order: 10 + i });
    denseFigure.composition.order.push(nodeId);
    denseVisual.bindings.push({ ...structuredClone(templateBinding), node_id: nodeId });
  }
  const fig = promoteFigure(denseFigure);
  const vis = promoteVisual(fig, denseVisual);
  const result = compileProfilePlan(fig, vis, target);
  assert.equal(result.status, "fail");
  assert.ok(has(result, "PRF006_DENSITY"));
});

test("presentation target enforces five-percent safe margins", () => {
  const presentationFigure = structuredClone(figure);
  presentationFigure.profile = "presentation";
  const presentationTarget = structuredClone(target);
  presentationTarget.target.profile = "presentation";
  presentationTarget.target.viewport = { width: 1920, height: 1080 };
  presentationTarget.target.safe_area = { top: 20, right: 20, bottom: 20, left: 20 };
  const fig = promoteFigure(presentationFigure);
  const vis = promoteVisual(fig);
  const result = compileProfilePlan(fig, vis, presentationTarget);
  assert.equal(result.status, "fail");
  assert.ok(has(result, "PRF001_TARGET"));
});

test("technical-explainer motion envelope rejects cues below its duration floor", () => {
  const fig = promoteFigure();
  const vis = promoteVisual(fig);
  const profile = promoteProfilePlan(fig, vis, target);
  assert.equal(profile.promoted, true);
  const tooFast = structuredClone(motion);
  tooFast.events[0].cues[0].duration_ms = 100;
  const report = validateProfileMotion(profile, tooFast);
  assert.equal(report.status, "fail");
  assert.ok(has(report, "PRF007_MOTION"));
});

test("presentation profile rejects repeat autoplay motion", () => {
  const presentationFigure = structuredClone(figure);
  presentationFigure.profile = "presentation";
  const presentationTarget = structuredClone(target);
  presentationTarget.target.profile = "presentation";
  presentationTarget.target.viewport = { width: 1920, height: 1080 };
  presentationTarget.target.safe_area = { top: 100, right: 100, bottom: 100, left: 100 };
  presentationTarget.options.min_gap = 24;
  const fig = promoteFigure(presentationFigure);
  const vis = promoteVisual(fig);
  const profile = promoteProfilePlan(fig, vis, presentationTarget);
  assert.equal(profile.promoted, true);
  const report = validateProfileMotion(profile, motion);
  assert.equal(report.status, "fail");
  assert.ok(has(report, "PRF007_MOTION"));
});

test("profile identity is bound into promoted layout identity", () => {
  const fig = promoteFigure();
  const vis = promoteVisual(fig);
  const profile = promoteProfilePlan(fig, vis, target);
  assert.equal(profile.promoted, true);
  const layout = promoteProfileLayout(fig, vis, profile);
  assert.equal(layout.promoted, true);
  assert.equal(layout.layout_intent.profile_plan_hash, profile.profile_plan.plan_hash);
  assert.equal(layout.resolved_layout.profile_threshold_hash, profile.promotion_receipt.threshold_hash);
  assert.equal(layout.promotion_receipt.profile_registry_hash, profile.promotion_receipt.profile_registry_hash);
});
