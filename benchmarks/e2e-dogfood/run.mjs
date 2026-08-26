#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promoteFigureSpec } from "../../skills/figthread/runtime/validator.js";
import { promoteGrammarPlan } from "../../skills/figthread/runtime/grammar.js";
import { promoteVisualSpec } from "../../skills/figthread/runtime/visual.js";
import { promoteProfilePlan } from "../../skills/figthread/runtime/profile.js";
import { promoteProfileLayout } from "../../skills/figthread/runtime/visual-layout.js";
import { promoteRenderedSvg } from "../../skills/figthread/runtime/renderer.js";
import { promoteProfileMotionProgram } from "../../skills/figthread/runtime/profile-motion.js";
import { promoteFigthreadDocument } from "../../skills/figthread/runtime/document.js";
import { exportPayloadToBuffer, promoteExportArtifact } from "../../skills/figthread/runtime/export.js";
import {
  createWorkspaceCheckpoint,
  initializeWorkspace,
  promoteStage,
  reopenStage,
  resumeWorkspace,
  verifyWorkspace
} from "../../skills/figthread/runtime/execution.js";

const scriptPath = fileURLToPath(import.meta.url);
const sourcePath = fileURLToPath(new URL("./source.md", import.meta.url));
const examplesRoot = new URL("../../skills/figthread/examples/", import.meta.url);
const stageDirs = {
  "figure-ir": "03-figure-ir",
  "grammar-visual": "04-grammar-visual",
  layout: "05-layout",
  motion: "06-motion",
  document: "07-document",
  review: "08-review",
  export: "09-export"
};
const requiredTerminalLabel = "Delivered Result";

async function loadExample(name) {
  return JSON.parse(await readFile(new URL(name, examplesRoot), "utf8"));
}
async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function mustPromote(name, value) {
  assert.equal(value?.promoted, true, `${name} promotion failed: ${JSON.stringify(value?.report?.issues ?? value?.report ?? value)}`);
  return value;
}
function authorityHash(promotion, preferred) {
  const receipt = promotion?.promotion_receipt;
  const value = preferred ? receipt?.[preferred] : receipt?.promotion_hash;
  assert.match(value ?? "", /^sha256:[0-9a-f]{64}$/, `missing authority hash ${preferred ?? "promotion_hash"}`);
  return value;
}
async function promoteWorkspaceStage(runDir, expectedStage, stem, artifactValue, evidenceValue, authorityHashes = {}, extraArtifacts = []) {
  const packet = await resumeWorkspace(runDir);
  assert.equal(packet.status, "ready");
  assert.equal(packet.frontier_stage, expectedStage);
  const artifactPath = join(runDir, packet.revision_dir, `${stem}.json`);
  const evidencePath = join(runDir, packet.revision_dir, `${stem}.evidence.json`);
  await writeJson(artifactPath, artifactValue);
  await writeJson(evidencePath, evidenceValue);
  const promotion = await promoteStage(runDir, expectedStage, {
    artifacts: [artifactPath, ...extraArtifacts],
    evidence: [evidencePath],
    authority_hashes: authorityHashes
  });
  assert.equal(promotion.promoted, true);
  return { packet, promotion, artifactPath, evidencePath };
}
function benchmarkFigure(base, corrected) {
  const figure = structuredClone(base);
  const terminal = figure.nodes.find((node) => node.id === "node:output");
  assert.ok(terminal);
  terminal.label = corrected ? requiredTerminalLabel : "Output";
  return figure;
}
function reviewProjection(renderPromotion, documentPromotion, expectedLabel) {
  const svg = renderPromotion.rendered_svg.svg;
  const html = documentPromotion.figthread_document.html;
  const svgContains = svg.includes(expectedLabel);
  const htmlContains = html.includes(expectedLabel);
  return {
    pass: svgContains && htmlContains,
    expected_label: expectedLabel,
    svg_contains_expected_label: svgContains,
    html_contains_expected_label: htmlContains,
    svg_hash: renderPromotion.promotion_receipt.svg_hash,
    html_hash: documentPromotion.promotion_receipt.html_hash
  };
}
async function readStageArtifact(runDir, stageId, revision, name) {
  return JSON.parse(await readFile(join(runDir, "stages", stageDirs[stageId], `r${String(revision).padStart(4, "0")}`, name), "utf8"));
}
async function phaseA(rootArg) {
  const root = rootArg ? resolve(rootArg) : await mkdtemp(join(tmpdir(), "figthread-dogfood-root-"));
  await mkdir(root, { recursive: true });
  const workspaceRoot = await mkdtemp(join(root, "workspace-"));
  const init = await initializeWorkspace(workspaceRoot, sourcePath, { runId: "run-e2e-dogfood" });
  const runDir = init.run_dir;
  const [baseFigure, visual, target] = await Promise.all([
    loadExample("minimal.figure.json"),
    loadExample("minimal.visual.json"),
    loadExample("minimal.layout-target.json")
  ]);

  await promoteWorkspaceStage(runDir, "understanding", "understanding", {
    primary_question: "How does a request move through explicit intermediate state to a delivered result?",
    reading_axis: "left-right",
    required_terminal_label: requiredTerminalLabel,
    motion_requirement: "enqueue, transfer, reset"
  }, {
    source_hash: init.source_hash,
    checks: ["fixed pipeline order found", "queue summary state found", "terminal wording constraint found", "motion loop requirement found"]
  });

  await promoteWorkspaceStage(runDir, "claims", "claims", {
    claims: [
      { id: "claim:primary", statement: "A request moves through a deterministic processing pipeline." },
      { id: "claim:queue", statement: "The queue makes intermediate state explicit." }
    ],
    required_terminal_label: requiredTerminalLabel
  }, {
    source_mapping: {
      "claim:primary": "fixed request pipeline order",
      "claim:queue": "explicit queue exposes intermediate state",
      terminal_label: requiredTerminalLabel
    }
  });

  const figure = benchmarkFigure(baseFigure, false);
  const figurePromotion = mustPromote("semantic", promoteFigureSpec(figure));
  await promoteWorkspaceStage(runDir, "figure-ir", "figure-promotion", { figure, figurePromotion }, {
    semantic_report: figurePromotion.report,
    note: "Core semantic gate passes; source wording fidelity is intentionally deferred to exact artifact review."
  }, { semantic: authorityHash(figurePromotion, "input_hash") });

  const grammarPromotion = mustPromote("grammar", promoteGrammarPlan(figurePromotion));
  const visualPromotion = mustPromote("visual", promoteVisualSpec(figurePromotion, visual));
  await promoteWorkspaceStage(runDir, "grammar-visual", "grammar-visual-promotion", { grammarPromotion, visualPromotion }, {
    grammar_report: grammarPromotion.report,
    visual_report: visualPromotion.report
  }, {
    grammar: authorityHash(grammarPromotion, "grammar_plan_hash"),
    visual: authorityHash(visualPromotion, "visual_hash"),
    "primitive-plan": authorityHash(visualPromotion, "primitive_plan_hash")
  });

  const profilePromotion = mustPromote("profile", promoteProfilePlan(figurePromotion, visualPromotion, target));
  const layoutPromotion = mustPromote("layout", promoteProfileLayout(figurePromotion, grammarPromotion, visualPromotion, profilePromotion));
  const renderPromotion = mustPromote("render", promoteRenderedSvg(figurePromotion, visualPromotion, profilePromotion, layoutPromotion));
  await promoteWorkspaceStage(runDir, "layout", "layout-render-promotion", { profilePromotion, layoutPromotion, renderPromotion }, {
    profile_report: profilePromotion.report,
    layout_report: layoutPromotion.report,
    rendered_evidence: renderPromotion.rendered_svg.evidence
  }, {
    "profile-plan": authorityHash(profilePromotion, "profile_plan_hash"),
    layout: authorityHash(layoutPromotion, "layout_hash"),
    render: authorityHash(renderPromotion, "render_hash")
  });

  const checkpoint = await createWorkspaceCheckpoint(runDir, "fresh-worker-handoff-after-layout");
  const packet = await resumeWorkspace(runDir);
  assert.equal(packet.status, "ready");
  assert.equal(packet.frontier_stage, "motion");
  await writeJson(join(runDir, "logs", "fresh-worker-handoff.json"), { checkpoint_hash: checkpoint.checkpoint.checkpoint_hash, packet });
  return { status: "handoff-ready", run_dir: runDir, frontier_stage: packet.frontier_stage, checkpoint_hash: checkpoint.checkpoint.checkpoint_hash };
}

async function phaseB(runDirArg) {
  const runDir = resolve(runDirArg);
  const freshPacket = await resumeWorkspace(runDir);
  assert.equal(freshPacket.status, "ready");
  assert.equal(freshPacket.frontier_stage, "motion");
  const [visual, target, motion, exportSpec] = await Promise.all([
    loadExample("minimal.visual.json"),
    loadExample("minimal.layout-target.json"),
    loadExample("minimal.motion.json"),
    loadExample("minimal.export.json")
  ]);
  const stage3v1 = await readStageArtifact(runDir, "figure-ir", 1, "figure-promotion.json");
  const stage4v1 = await readStageArtifact(runDir, "grammar-visual", 1, "grammar-visual-promotion.json");
  const stage5v1 = await readStageArtifact(runDir, "layout", 1, "layout-render-promotion.json");
  const figure1 = stage3v1.figure;
  const figurePromotion1 = stage3v1.figurePromotion;
  const { grammarPromotion: grammarPromotion1, visualPromotion: visualPromotion1 } = stage4v1;
  const { profilePromotion: profilePromotion1, layoutPromotion: layoutPromotion1, renderPromotion: renderPromotion1 } = stage5v1;

  const motionPromotion1 = mustPromote("motion-v1", promoteProfileMotionProgram(figurePromotion1, profilePromotion1, layoutPromotion1, motion));
  await promoteWorkspaceStage(runDir, "motion", "motion-promotion", { motion, motionPromotion: motionPromotion1 }, { motion_report: motionPromotion1.report }, { motion: authorityHash(motionPromotion1, "program_hash") });

  const authorities1 = { figurePromotion: figurePromotion1, grammarPromotion: grammarPromotion1, visualPromotion: visualPromotion1, profilePromotion: profilePromotion1, layoutPromotion: layoutPromotion1, renderPromotion: renderPromotion1, motionPromotion: motionPromotion1 };
  const canonical1 = { figure: figure1, visual, target, motion };
  const documentPromotion1 = mustPromote("document-v1", promoteFigthreadDocument(authorities1, canonical1));
  const docPacket1 = await resumeWorkspace(runDir);
  assert.equal(docPacket1.frontier_stage, "document");
  const htmlPath1 = join(runDir, docPacket1.revision_dir, "figure.html");
  await writeFile(htmlPath1, documentPromotion1.figthread_document.html, "utf8");
  await promoteWorkspaceStage(runDir, "document", "document-promotion", { documentPromotion: documentPromotion1 }, {
    document_hashes: documentPromotion1.promotion_receipt,
    self_contained: true
  }, { document: authorityHash(documentPromotion1) }, [htmlPath1]);

  const initialReview = reviewProjection(renderPromotion1, documentPromotion1, requiredTerminalLabel);
  assert.equal(initialReview.pass, false, "the benchmark must expose the intentional source-wording defect before reopen");
  await promoteWorkspaceStage(runDir, "review", "review", {
    decision: "reopen",
    reopen_stage: "figure-ir",
    finding: {
      code: "BENCH001_TERMINAL_WORDING",
      message: `Rendered terminal label must preserve source wording: ${requiredTerminalLabel}`
    }
  }, initialReview, {
    render: authorityHash(renderPromotion1, "render_hash"),
    document: authorityHash(documentPromotion1)
  });

  const oldDocumentBytes = await readFile(htmlPath1);
  const reopened = await reopenStage(runDir, "figure-ir", "exact artifact review found terminal wording lost upstream in FigureSpec");
  assert.deepEqual(reopened.invalidated.map((entry) => entry.stage_id), ["figure-ir", "grammar-visual", "layout", "motion", "document", "review"]);
  const manifestAfterReopen = JSON.parse(await readFile(join(runDir, "run.json"), "utf8"));
  for (const stageId of ["figure-ir", "grammar-visual", "layout", "motion", "document", "review", "export"]) {
    assert.equal(manifestAfterReopen.revisions[stageId], 2, `${stageId} must advance to a new revision instead of reusing r0001`);
  }
  const reopenPacket = await resumeWorkspace(runDir);
  assert.equal(reopenPacket.frontier_stage, "figure-ir");
  assert.equal(reopenPacket.revision_dir, "stages/03-figure-ir/r0002");

  const figure2 = benchmarkFigure(figure1, true);
  const figurePromotion2 = mustPromote("semantic-v2", promoteFigureSpec(figure2));
  await promoteWorkspaceStage(runDir, "figure-ir", "figure-promotion", { figure: figure2, figurePromotion: figurePromotion2 }, {
    semantic_report: figurePromotion2.report,
    repaired_source_wording: requiredTerminalLabel
  }, { semantic: authorityHash(figurePromotion2, "input_hash") });

  const grammarPromotion2 = mustPromote("grammar-v2", promoteGrammarPlan(figurePromotion2));
  const visualPromotion2 = mustPromote("visual-v2", promoteVisualSpec(figurePromotion2, visual));
  await promoteWorkspaceStage(runDir, "grammar-visual", "grammar-visual-promotion", { grammarPromotion: grammarPromotion2, visualPromotion: visualPromotion2 }, {
    grammar_report: grammarPromotion2.report,
    visual_report: visualPromotion2.report
  }, {
    grammar: authorityHash(grammarPromotion2, "grammar_plan_hash"),
    visual: authorityHash(visualPromotion2, "visual_hash"),
    "primitive-plan": authorityHash(visualPromotion2, "primitive_plan_hash")
  });

  const profilePromotion2 = mustPromote("profile-v2", promoteProfilePlan(figurePromotion2, visualPromotion2, target));
  const layoutPromotion2 = mustPromote("layout-v2", promoteProfileLayout(figurePromotion2, grammarPromotion2, visualPromotion2, profilePromotion2));
  const renderPromotion2 = mustPromote("render-v2", promoteRenderedSvg(figurePromotion2, visualPromotion2, profilePromotion2, layoutPromotion2));
  await promoteWorkspaceStage(runDir, "layout", "layout-render-promotion", { profilePromotion: profilePromotion2, layoutPromotion: layoutPromotion2, renderPromotion: renderPromotion2 }, {
    profile_report: profilePromotion2.report,
    layout_report: layoutPromotion2.report,
    rendered_evidence: renderPromotion2.rendered_svg.evidence
  }, {
    "profile-plan": authorityHash(profilePromotion2, "profile_plan_hash"),
    layout: authorityHash(layoutPromotion2, "layout_hash"),
    render: authorityHash(renderPromotion2, "render_hash")
  });

  const motionPromotion2 = mustPromote("motion-v2", promoteProfileMotionProgram(figurePromotion2, profilePromotion2, layoutPromotion2, motion));
  await promoteWorkspaceStage(runDir, "motion", "motion-promotion", { motion, motionPromotion: motionPromotion2 }, { motion_report: motionPromotion2.report }, { motion: authorityHash(motionPromotion2, "program_hash") });

  const authorities2 = { figurePromotion: figurePromotion2, grammarPromotion: grammarPromotion2, visualPromotion: visualPromotion2, profilePromotion: profilePromotion2, layoutPromotion: layoutPromotion2, renderPromotion: renderPromotion2, motionPromotion: motionPromotion2 };
  const canonical2 = { figure: figure2, visual, target, motion };
  const documentPromotion2 = mustPromote("document-v2", promoteFigthreadDocument(authorities2, canonical2));
  const docPacket2 = await resumeWorkspace(runDir);
  assert.equal(docPacket2.revision, 2);
  const htmlPath2 = join(runDir, docPacket2.revision_dir, "figure.html");
  await writeFile(htmlPath2, documentPromotion2.figthread_document.html, "utf8");
  await promoteWorkspaceStage(runDir, "document", "document-promotion", { documentPromotion: documentPromotion2 }, {
    document_hashes: documentPromotion2.promotion_receipt,
    source_wording_present: documentPromotion2.figthread_document.html.includes(requiredTerminalLabel)
  }, { document: authorityHash(documentPromotion2) }, [htmlPath2]);

  const finalReview = reviewProjection(renderPromotion2, documentPromotion2, requiredTerminalLabel);
  assert.equal(finalReview.pass, true, "reopened figure must repair the exact rendered artifact");
  await promoteWorkspaceStage(runDir, "review", "review", { decision: "accept", finding_count: 0 }, finalReview, {
    render: authorityHash(renderPromotion2, "render_hash"),
    document: authorityHash(documentPromotion2)
  });

  const exportPromotion = mustPromote("export", await promoteExportArtifact(documentPromotion2, renderPromotion2, exportSpec));
  const exportPacket = await resumeWorkspace(runDir);
  assert.equal(exportPacket.frontier_stage, "export");
  assert.equal(exportPacket.revision, 2);
  const finalSvgPath = join(runDir, "final", "figure.svg");
  await writeFile(finalSvgPath, exportPayloadToBuffer(exportPromotion.payload));
  const exportPromotionPath = join(runDir, exportPacket.revision_dir, "export-promotion.json");
  await writeJson(exportPromotionPath, { exportSpec, exportPromotion: { ...exportPromotion, payload: { encoding: exportPromotion.payload.encoding, data: "[bound-by-final/figure.svg]" } } });
  const reportPath = join(runDir, exportPacket.revision_dir, "DOGFOOD_REPORT.md");
  const report = `# Figthread end-to-end dogfood report\n\n- fresh-worker resume frontier: motion\n- initial exact-artifact review: FAIL as intended; terminal label was Output\n- causal reopen owner: figure-ir\n- invalidated promoted descendants: ${reopened.invalidated.map((entry) => entry.stage_id).join(", ")}\n- downstream revision policy: advanced to r0002, preserving r0001 history\n- repaired terminal label: ${requiredTerminalLabel}\n- final exact-artifact review: PASS\n- final export content hash: ${exportPromotion.export_artifact.content_hash}\n\nThe benchmark process verifies workspace completion after the export receipt is promoted.\n`;
  await writeFile(reportPath, report, "utf8");
  const exportEvidencePath = join(runDir, exportPacket.revision_dir, "export.evidence.json");
  await writeJson(exportEvidencePath, {
    final_review: finalReview,
    content_hash: exportPromotion.export_artifact.content_hash,
    artifact_hash: exportPromotion.export_artifact.artifact_hash,
    deterministic_scope: exportPromotion.export_artifact.determinism_scope
  });
  const exportStage = await promoteStage(runDir, "export", {
    artifacts: [exportPromotionPath, reportPath, finalSvgPath],
    evidence: [exportEvidencePath],
    authority_hashes: { "export-artifact": authorityHash(exportPromotion, "artifact_hash") }
  });
  assert.equal(exportStage.complete, true);

  const completion = await verifyWorkspace(runDir);
  assert.equal(completion.valid, true);
  assert.equal(completion.complete, true);
  const oldDocumentBytesAfter = await readFile(htmlPath1);
  assert.deepEqual(oldDocumentBytesAfter, oldDocumentBytes, "reopen must preserve prior revision bytes exactly");
  const finalPacket = await resumeWorkspace(runDir);
  assert.equal(finalPacket.status, "complete");
  const finalManifest = JSON.parse(await readFile(join(runDir, "run.json"), "utf8"));
  return {
    status: "complete",
    run_dir: runDir,
    fresh_worker_frontier: freshPacket.frontier_stage,
    initial_review: initialReview,
    reopen_stage: reopened.stage_id,
    invalidated_stages: reopened.invalidated.map((entry) => entry.stage_id),
    final_review: finalReview,
    revisions: finalManifest.revisions,
    final_export_content_hash: exportPromotion.export_artifact.content_hash,
    final_run_hash: completion.run_hash,
    report_path: reportPath
  };
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}
function runChild(args) {
  const stdout = execFileSync(process.execPath, [scriptPath, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  return JSON.parse(stdout);
}

const args = process.argv.slice(2);
const mode = args[0] ?? "all";
try {
  if (mode === "phase-a") {
    const result = await phaseA(option(args, "--root"));
    process.stdout.write(JSON.stringify(result));
  } else if (mode === "phase-b") {
    const runDir = option(args, "--run");
    if (!runDir) throw new Error("phase-b requires --run <run-dir>");
    const result = await phaseB(runDir);
    process.stdout.write(JSON.stringify(result));
  } else if (mode === "all") {
    const root = option(args, "--root") ?? await mkdtemp(join(tmpdir(), "figthread-dogfood-all-"));
    await mkdir(root, { recursive: true });
    const phaseAResult = runChild(["phase-a", "--root", root]);
    const phaseBResult = runChild(["phase-b", "--run", phaseAResult.run_dir]);
    process.stdout.write(JSON.stringify({ ...phaseBResult, phase_a_checkpoint_hash: phaseAResult.checkpoint_hash, worker_processes: 2 }));
  } else {
    throw new Error("usage: run.mjs [all|phase-a|phase-b] [--root dir] [--run run-dir]");
  }
} catch (error) {
  console.error(JSON.stringify({ status: "fail", error: error.message, stack: error.stack }, null, 2));
  process.exitCode = 1;
}
