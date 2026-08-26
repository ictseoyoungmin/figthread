import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const runner = fileURLToPath(new URL("../benchmarks/e2e-dogfood/run.mjs", import.meta.url));

test("full dogfood survives fresh-worker handoff, causal reopen, and exact export", async () => {
  const root = await mkdtemp(join(tmpdir(), "figthread-benchmark-test-"));
  const stdout = execFileSync(process.execPath, [runner, "all", "--root", root], { encoding: "utf8" });
  const result = JSON.parse(stdout);
  assert.equal(result.status, "complete");
  assert.equal(result.worker_processes, 2);
  assert.equal(result.fresh_worker_frontier, "motion");
  assert.equal(result.initial_review.pass, false);
  assert.equal(result.reopen_stage, "figure-ir");
  assert.deepEqual(result.invalidated_stages, ["figure-ir", "grammar-visual", "layout", "motion", "document", "review"]);
  assert.equal(result.final_review.pass, true);
  for (const stage of ["figure-ir", "grammar-visual", "layout", "motion", "document", "review", "export"]) assert.equal(result.revisions[stage], 2);
  assert.match(result.final_export_content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.match(result.final_run_hash, /^sha256:[0-9a-f]{64}$/);
});
