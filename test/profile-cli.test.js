import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = "skills/figthread/scripts/profile.mjs";
const figure = "skills/figthread/examples/minimal.figure.json";
const visual = "skills/figthread/examples/minimal.visual.json";
const target = "skills/figthread/examples/minimal.layout-target.json";

function run(extra = []) {
  return spawnSync(process.execPath, [script, figure, visual, target, ...extra], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
}

test("profile CLI accepts default gate mode", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "pass");
  assert.equal(output.promotion_eligible, true);
  assert.equal(output.profile_id, "technical-explainer");
  assert.ok(output.profile_plan.plan_hash.startsWith("sha256:"));
});

test("profile CLI promotion emits a stable profile plan receipt", () => {
  const a = run(["--promote"]);
  const b = run(["--promote"]);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  const first = JSON.parse(a.stdout);
  const second = JSON.parse(b.stdout);
  assert.equal(first.promoted, true);
  assert.equal(first.promotion_receipt.kind, "profile_plan");
  assert.equal(first.promotion_receipt.promotion_hash, second.promotion_receipt.promotion_hash);
});

test("profile CLI explicit draft mode remains non-authoritative", () => {
  const result = run(["--mode", "draft"]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.mode, "draft");
  assert.equal(output.promotion_eligible, false);
});
