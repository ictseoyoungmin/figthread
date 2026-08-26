import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initializeWorkspace, promoteStage, reopenStage, resumeWorkspace } from "../skills/figthread/runtime/execution.js";

async function promoteFrontier(run, marker) {
  const packet = await resumeWorkspace(run);
  assert.equal(packet.status, "ready");
  const artifact = join(run, packet.revision_dir, `${marker}.txt`);
  const evidence = join(run, packet.revision_dir, `${marker}.evidence.txt`);
  await writeFile(artifact, `${marker}:${packet.frontier_stage}:${packet.revision}`, "utf8");
  await writeFile(evidence, `evidence:${marker}:${packet.frontier_stage}:${packet.revision}`, "utf8");
  return promoteStage(run, packet.frontier_stage, { artifacts: [artifact], evidence: [evidence] });
}

test("reopen advances every started descendant revision and never reuses r0001", async () => {
  const root = await mkdtemp(join(tmpdir(), "figthread-revision-"));
  const source = join(root, "source.txt");
  await writeFile(source, "benchmark source", "utf8");
  const init = await initializeWorkspace(join(root, "runs"), source, { runId: "run-revision" });
  const run = init.run_dir;

  for (const marker of ["understanding", "claims", "figure", "grammar", "layout", "motion", "document", "review"]) await promoteFrontier(run, marker);
  const oldGrammar = join(run, "stages/04-grammar-visual/r0001/grammar.txt");
  const oldGrammarBytes = await readFile(oldGrammar);

  const reopened = await reopenStage(run, "figure-ir", "review exposed an upstream wording cause");
  assert.equal(reopened.revision, 2);
  assert.ok(reopened.invalidated.every((entry) => entry.reopen_revision === 2));
  const manifest = JSON.parse(await readFile(join(run, "run.json"), "utf8"));
  for (const stage of ["figure-ir", "grammar-visual", "layout", "motion", "document", "review", "export"]) assert.equal(manifest.revisions[stage], 2, `${stage} must advance to r0002`);

  for (const marker of ["figure-v2", "grammar-v2", "layout-v2", "motion-v2", "document-v2", "review-v2", "export-v2"]) await promoteFrontier(run, marker);
  assert.deepEqual(await readFile(oldGrammar), oldGrammarBytes);
  assert.equal((await resumeWorkspace(run)).status, "complete");
});
