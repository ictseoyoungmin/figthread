import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promoteFigureSpec, validateFigureSpec } from "../skills/figthread/runtime/validator.js";

const fixture = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.figure.json", import.meta.url), "utf8"));
const clone = () => structuredClone(fixture);
const has = (report, code, objectId) => report.issues.some((issue) => issue.code === code && (objectId === undefined || issue.object_id === objectId));

test("minimal FigureSpec passes structural + semantic gate", () => {
  const report = validateFigureSpec(fixture, { mode: "gate" });
  assert.equal(report.status, "pass"); assert.equal(report.promotion_eligible, true); assert.match(report.input_hash, /^sha256:[0-9a-f]{64}$/);
});
test("structural schema rejects missing fields, enum drift, and unknown keys", () => {
  const doc = clone(); delete doc.emphasis; doc.profile = "unknown"; doc.unexpected = true;
  const report = validateFigureSpec(doc); assert.equal(report.status, "fail"); assert.ok(report.issues.filter((x) => x.code === "SCH001").length >= 3);
});
test("IR001 and IR002 report duplicates and typed dangling references", () => {
  const doc = clone(); doc.nodes[2].id = "node:input"; doc.relations[0].to = "node:missing"; doc.composition.order.push("node:gone");
  const report = validateFigureSpec(doc); assert.ok(has(report, "IR001", "node:input")); assert.ok(has(report, "IR002", "relation:input-queue")); assert.ok(report.issues.some((x) => x.code === "IR002" && x.path === "composition.order"));
});
test("IR003 requires every semantic node to reach the composition root", () => { const doc = clone(); delete doc.nodes.find((x) => x.id === "node:queue").parent_id; assert.ok(has(validateFigureSpec(doc), "IR003", "node:queue")); });
test("IR003 requires the composition root to be parentless", () => { const doc = clone(); doc.nodes[0].parent_id = "node:input"; assert.ok(has(validateFigureSpec(doc), "IR003", "node:root")); });
test("IR003 detects parent cycles", () => { const doc = clone(); doc.nodes.find((x) => x.id === "node:input").parent_id = "node:queue"; doc.nodes.find((x) => x.id === "node:queue").parent_id = "node:input"; assert.ok(has(validateFigureSpec(doc), "IR003")); });
test("IR004 witnesses must be reachable", () => { const doc = clone(); doc.nodes.forEach((n) => { n.claim_refs = n.id === "node:queue" ? ["claim:queue"] : []; }); doc.relations.forEach((r) => { r.claim_refs = []; }); assert.ok(has(validateFigureSpec(doc), "IR004", "claim:primary")); });
test("IR005 walks descendants recursively", () => { const doc = clone(); doc.nodes.push({ id: "node:group", kind: "group", parent_id: "node:root", claim_refs: [] }); doc.nodes.push({ id: "node:nested", kind: "annotation", parent_id: "node:group", claim_refs: ["claim:queue"] }); const report = validateFigureSpec(doc); assert.equal(report.issues.some((x) => x.code === "IR005" && x.object_id === "node:group"), false); });
test("IR006 validates count semantics and numeric bounds", () => { const doc = clone(); doc.states[0].summary = 1.5; assert.ok(has(validateFigureSpec(doc), "IR006", "state:queue-count")); });
test("IR006 rejects inverted numeric bounds", () => { const doc = clone(); doc.states[0].domain.min = 5; doc.states[0].domain.max = 1; assert.ok(has(validateFigureSpec(doc), "IR006", "state:queue-count")); });
test("IR007 validates static snapshot references, domains, and summary reproducibility", () => { const doc = clone(); doc.snapshots[0].state_values["state:queue-count"] = 2; assert.ok(has(validateFigureSpec(doc), "IR007", "snapshot:summary")); const missing = clone(); missing.snapshots[0].state_values = {}; assert.ok(has(validateFigureSpec(missing), "IR007", "snapshot:summary")); });
test("IR002 rejects unknown snapshot state and emphasis references", () => { const doc = clone(); doc.snapshots[0].state_values["state:missing"] = 1; doc.emphasis.primary.push("node:missing"); const report = validateFigureSpec(doc); assert.ok(has(report, "IR002", "snapshot:summary")); assert.ok(report.issues.some((x) => x.code === "IR002" && x.path === "emphasis.primary")); });
test("IR008 finds geometry nested inside arrays", () => { const doc = clone(); doc.nodes[1].data = { points: [{ x: 10, y: 20 }] }; assert.ok(has(validateFigureSpec(doc), "IR008", "node:input")); });
test("IR009 enforces namespaced extension relations", () => { const doc = clone(); doc.relations.push({ id: "relation:ext", kind: "extension", from: "node:input", to: "node:output", extension_kind: "bad" }); assert.ok(has(validateFigureSpec(doc), "IR009", "relation:ext")); });
test("grammar role bindings resolve to nodes", () => { const doc = clone(); doc.composition.grammar.role_bindings.stages.push("node:missing"); assert.ok(validateFigureSpec(doc).issues.some((x) => x.code === "IR002" && x.path === "composition.grammar.role_bindings")); });
test("reports are deterministically ordered", () => { const doc = clone(); doc.nodes[1].data = { z: [{ x: 1 }], y: 2 }; doc.emphasis.muted.push("node:missing"); assert.deepEqual(validateFigureSpec(doc).issues, validateFigureSpec(doc).issues); });
test("draft never promotes and gate promotion produces a stable receipt", () => { const draft = validateFigureSpec(fixture, { mode: "draft" }); assert.equal(draft.promotion_eligible, false); const a = promoteFigureSpec(fixture), b = promoteFigureSpec(fixture); assert.equal(a.promoted, true); assert.equal(a.promotion_receipt.promotion_hash, b.promotion_receipt.promotion_hash); });
test("repository mirrors stay byte-identical to the installable skill source", async () => { const [rootSchema, skillSchema, rootExample, skillExample] = await Promise.all([readFile(new URL("../schemas/figure-spec.schema.json", import.meta.url), "utf8"), readFile(new URL("../skills/figthread/schemas/figure-spec.schema.json", import.meta.url), "utf8"), readFile(new URL("../examples/minimal.figure.json", import.meta.url), "utf8"), readFile(new URL("../skills/figthread/examples/minimal.figure.json", import.meta.url), "utf8")]); assert.equal(rootSchema, skillSchema); assert.equal(rootExample, skillExample); });
test("promoted snapshot and receipt are frozen", () => { const result = promoteFigureSpec(fixture); assert.equal(result.promoted, true); assert.equal(Object.isFrozen(result.validated_figure), true); assert.equal(Object.isFrozen(result.validated_figure.nodes), true); assert.equal(Object.isFrozen(result.promotion_receipt), true); });
