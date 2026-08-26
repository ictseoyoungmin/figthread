import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promoteFigureSpec } from "../skills/figthread/runtime/validator.js";
import { promoteGrammarPlan } from "../skills/figthread/runtime/grammar.js";
import { promoteVisualSpec } from "../skills/figthread/runtime/visual.js";
import { promoteProfilePlan } from "../skills/figthread/runtime/profile.js";
import { compilePromotedLayout } from "../skills/figthread/runtime/layout.js";
import { promoteProfileLayout } from "../skills/figthread/runtime/visual-layout.js";

const baseFigure = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.figure.json", import.meta.url), "utf8"));
const baseVisual = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.visual.json", import.meta.url), "utf8"));
const baseTarget = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.layout-target.json", import.meta.url), "utf8"));
const baseRequest = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.layout-request.json", import.meta.url), "utf8"));

const centerOf = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
function promoteAll(figure, visual, target) {
  const semantic = promoteFigureSpec(figure); assert.equal(semantic.promoted, true);
  const grammar = promoteGrammarPlan(semantic); assert.equal(grammar.promoted, true);
  const primitive = promoteVisualSpec(semantic, visual); assert.equal(primitive.promoted, true);
  const profile = promoteProfilePlan(semantic, primitive, target); assert.equal(profile.promoted, true);
  const layout = promoteProfileLayout(semantic, grammar, primitive, profile); assert.equal(layout.promoted, true);
  return { semantic, grammar, primitive, profile, layout };
}
function lifecycleFixture() {
  const figure = structuredClone(baseFigure), visual = structuredClone(baseVisual), target = structuredClone(baseTarget);
  figure.id = "fig:radial-lifecycle"; visual.figure_id = figure.id; figure.figure_type = "lifecycle";
  figure.nodes.push({ id: "node:review", kind: "stage", label: "Review", parent_id: "node:root", claim_refs: ["claim:primary"], order: 3 });
  figure.relations = [
    { id: "relation:input-queue", kind: "flows-to", from: "node:input", to: "node:queue", claim_refs: ["claim:primary"] },
    { id: "relation:queue-output", kind: "flows-to", from: "node:queue", to: "node:output", claim_refs: ["claim:primary"] },
    { id: "relation:output-review", kind: "flows-to", from: "node:output", to: "node:review", claim_refs: ["claim:primary"] },
    { id: "relation:review-input", kind: "flows-to", from: "node:review", to: "node:input", claim_refs: ["claim:primary"] }
  ];
  figure.composition.grammar = { type: "lifecycle", version: "0.1", variant: "ring", reading_axis: "radial", role_bindings: { phases: ["node:input", "node:queue", "node:output", "node:review"] } };
  figure.composition.order = ["node:input", "node:queue", "node:output", "node:review"];
  visual.bindings.push({ node_id: "node:review", primitive: "core.compute@0.1", variant: "stage", salience: "S1", props: {}, state_bindings: {} });
  target.target.id = "radial-wide"; target.target.viewport = { width: 800, height: 600 };
  return { figure, visual, target };
}
function networkFixture() {
  const figure = structuredClone(baseFigure), visual = structuredClone(baseVisual), target = structuredClone(baseTarget);
  figure.id = "fig:radial-network"; visual.figure_id = figure.id; figure.figure_type = "network";
  figure.relations = [
    { id: "relation:hub-input", kind: "routes-to", from: "node:queue", to: "node:input", claim_refs: ["claim:primary"] },
    { id: "relation:hub-output", kind: "routes-to", from: "node:queue", to: "node:output", claim_refs: ["claim:primary"] }
  ];
  figure.composition.grammar = { type: "network", version: "0.1", variant: "radial", reading_axis: "radial", role_bindings: { nodes: ["node:input", "node:queue", "node:output"], hub: ["node:queue"] } };
  figure.composition.order = ["node:input", "node:queue", "node:output"];
  target.target.id = "radial-network"; target.target.viewport = { width: 800, height: 600 };
  return { figure, visual, target };
}

test("lifecycle radial layout promotes a deterministic clockwise ring", () => {
  const fixture = lifecycleFixture(), a = promoteAll(fixture.figure, fixture.visual, fixture.target), b = promoteAll(fixture.figure, fixture.visual, fixture.target);
  assert.equal(a.layout.promotion_receipt.promotion_hash, b.layout.promotion_receipt.promotion_hash);
  assert.equal(a.layout.layout_intent.grammar.primary_axis, "radial");
  assert.deepEqual(a.layout.layout_intent.ports["node:input"].allowed_sides, ["north", "east", "south", "west"]);
  const boxes = a.layout.resolved_layout.boxes, root = centerOf(boxes["node:root"]), input = centerOf(boxes["node:input"]), queue = centerOf(boxes["node:queue"]), output = centerOf(boxes["node:output"]), review = centerOf(boxes["node:review"]);
  assert.ok(input.y < root.y && Math.abs(input.x - root.x) < 1e-6);
  assert.ok(queue.x > root.x && Math.abs(queue.y - root.y) < 1e-6);
  assert.ok(output.y > root.y && Math.abs(output.x - root.x) < 1e-6);
  assert.ok(review.x < root.x && Math.abs(review.y - root.y) < 1e-6);
  assert.ok(Object.values(a.layout.resolved_layout.connectors).every((connector) => connector.obstacle_hits === 0));
  assert.equal(a.layout.resolved_layout.diagnostics.length, 0);
});

test("network radial layout binds the declared hub to the exact target center", () => {
  const fixture = networkFixture(), { layout } = promoteAll(fixture.figure, fixture.visual, fixture.target), boxes = layout.resolved_layout.boxes;
  const root = centerOf(boxes["node:root"]), hub = centerOf(boxes["node:queue"]), input = centerOf(boxes["node:input"]), output = centerOf(boxes["node:output"]);
  assert.deepEqual(hub, root);
  assert.ok(input.y < hub.y);
  assert.ok(output.y > hub.y);
  assert.equal(layout.resolved_layout.connectors["relation:hub-input"].source_anchor, "node:queue.north");
  assert.equal(layout.resolved_layout.connectors["relation:hub-output"].source_anchor, "node:queue.south");
  assert.equal(layout.resolved_layout.diagnostics.length, 0);
});

test("architecture hub-spoke infers the highest-degree component deterministically", () => {
  const figure = structuredClone(baseFigure), request = structuredClone(baseRequest); figure.figure_type = "architecture";
  figure.composition.grammar = { type: "architecture", version: "0.1", variant: "hub-spoke", reading_axis: "radial", role_bindings: { components: ["node:input", "node:queue", "node:output"] } };
  figure.relations = [
    { id: "relation:a", kind: "routes-to", from: "node:queue", to: "node:input", claim_refs: ["claim:primary"] },
    { id: "relation:b", kind: "routes-to", from: "node:queue", to: "node:output", claim_refs: ["claim:primary"] }
  ];
  request.target.viewport = { width: 800, height: 600 };
  const semantic = promoteFigureSpec(figure); assert.equal(semantic.promoted, true); const result = compilePromotedLayout(semantic, request); assert.equal(result.status, "pass");
  assert.deepEqual(centerOf(result.resolved_layout.boxes["node:queue"]), centerOf(result.resolved_layout.boxes["node:root"]));
});

test("feedback-loop mechanism uses the cycle solver rather than hub inference", () => {
  const figure = structuredClone(baseFigure), request = structuredClone(baseRequest); figure.figure_type = "mechanism";
  figure.composition.grammar = { type: "mechanism", version: "0.1", variant: "feedback-loop", reading_axis: "radial", role_bindings: { components: ["node:input", "node:queue", "node:output"] } };
  figure.relations = [
    { id: "relation:a", kind: "flows-to", from: "node:input", to: "node:queue", claim_refs: ["claim:primary"] },
    { id: "relation:b", kind: "flows-to", from: "node:queue", to: "node:output", claim_refs: ["claim:primary"] },
    { id: "relation:c", kind: "flows-to", from: "node:output", to: "node:input", claim_refs: ["claim:primary"] }
  ];
  request.target.viewport = { width: 800, height: 600 };
  const semantic = promoteFigureSpec(figure); assert.equal(semantic.promoted, true); const result = compilePromotedLayout(semantic, request); assert.equal(result.status, "pass");
  const root = centerOf(result.resolved_layout.boxes["node:root"]); assert.ok(Object.values(result.resolved_layout.boxes).filter((box) => box !== result.resolved_layout.boxes["node:root"]).every((box) => { const c=centerOf(box); return Math.abs(c.x-root.x)>1 || Math.abs(c.y-root.y)>1; }));
});

test("radial minimum footprints fail closed when no legal ring fits", () => {
  const { figure } = lifecycleFixture(), request = structuredClone(baseRequest); request.target.viewport = { width: 240, height: 200 }; request.measurements.push({ node_id: "node:review", min_w: 100, min_h: 60, pref_w: 140, pref_h: 80 });
  const semantic = promoteFigureSpec(figure); assert.equal(semantic.promoted, true); const result = compilePromotedLayout(semantic, request);
  assert.equal(result.status, "fail"); assert.ok(result.issues.some((entry) => entry.code === "LAY001_UNSAT")); assert.equal(result.resolved_layout, undefined);
});
