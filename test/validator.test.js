import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateFigureSpec } from "../src/validator.js";

const fixture = JSON.parse(await readFile(new URL("../examples/minimal.figure.json", import.meta.url), "utf8"));

test("minimal FigureSpec passes the semantic gate", () => {
  const report = validateFigureSpec(fixture);
  assert.equal(report.status, "pass");
  assert.deepEqual(report.issues, []);
});

test("reports duplicate IDs and dangling references deterministically", () => {
  const document = structuredClone(fixture);
  document.nodes[1].id = document.nodes[0].id;
  document.relations[0].to = "node:missing";

  const report = validateFigureSpec(document);
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some(({ code, object_id }) => code === "IR001" && object_id === "node:input"));
  assert.ok(report.issues.some(({ code, object_id }) => code === "IR002" && object_id === "relation:input-queue"));
});

test("rejects geometry in semantic objects and invalid state values", () => {
  const document = structuredClone(fixture);
  document.nodes[0].data = { x: 12 };
  document.states[0].summary = 8;

  const report = validateFigureSpec(document);
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some((entry) => entry.code === "IR006"));
  assert.ok(report.issues.some((entry) => entry.code === "IR008"));
});

test("requires a witness for primary claims", () => {
  const document = structuredClone(fixture);
  document.nodes.forEach((node) => { node.claim_refs = ["claim:queue"]; });
  document.relations.forEach((relation) => { relation.claim_refs = []; });

  const report = validateFigureSpec(document);
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some((entry) => entry.code === "IR004" && entry.object_id === "claim:primary"));
});
