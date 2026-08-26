import { createHash } from "node:crypto";
import { copyFile, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { sha256Canonical } from "./canonicalize.js";

export const EXECUTION_ENGINE_VERSION = "0.1.0";
export const RUN_SCHEMA_VERSION = "figthread.run/0.1";
export const STAGE_RECEIPT_SCHEMA_VERSION = "figthread.stage-receipt/0.1";
export const CHECKPOINT_SCHEMA_VERSION = "figthread.checkpoint/0.1";

export const EXECUTION_STAGES = Object.freeze([
  Object.freeze({ id: "understanding", ordinal: 1, dir: "01-understanding" }),
  Object.freeze({ id: "claims", ordinal: 2, dir: "02-claims" }),
  Object.freeze({ id: "figure-ir", ordinal: 3, dir: "03-figure-ir" }),
  Object.freeze({ id: "grammar-visual", ordinal: 4, dir: "04-grammar-visual" }),
  Object.freeze({ id: "layout", ordinal: 5, dir: "05-layout" }),
  Object.freeze({ id: "motion", ordinal: 6, dir: "06-motion" }),
  Object.freeze({ id: "document", ordinal: 7, dir: "07-document" }),
  Object.freeze({ id: "review", ordinal: 8, dir: "08-review" }),
  Object.freeze({ id: "export", ordinal: 9, dir: "09-export" })
]);

const LOCK_FILE = ".figthread-writer.lock";
const severityOrder = { error: 0, warning: 1, note: 2 };
const issue = (code, severity, message, extra = {}) => ({ code, severity, stage_owner: "execution", message, ...extra });
const sortIssues = (issues) => issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.code.localeCompare(b.code) || (a.stage_id ?? "").localeCompare(b.stage_id ?? "") || (a.path ?? "").localeCompare(b.path ?? "") || a.message.localeCompare(b.message));

function sha256Text(text) { return `sha256:${createHash("sha256").update(text).digest("hex")}`; }
function deepFreeze(value, seen = new Set()) { if (value === null || typeof value !== "object" || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) deepFreeze(child, seen); return Object.freeze(value); }
function padRevision(value) { return `r${String(value).padStart(4, "0")}`; }
function checkpointName(value, hash) { return `cp-${String(value).padStart(4, "0")}-${hash.slice(7, 15)}.json`; }
function hashBase(object, field) { const copy = structuredClone(object); delete copy[field]; return sha256Canonical(copy); }
function stageById(stageId) { return EXECUTION_STAGES.find((stage) => stage.id === stageId) ?? null; }
function stageIndex(stageId) { return EXECUTION_STAGES.findIndex((stage) => stage.id === stageId); }
function firstFrontier(manifest) { return EXECUTION_STAGES.find((stage) => !manifest.active_receipts[stage.id])?.id ?? null; }
function sourceDateStamp(date = new Date()) { const y = date.getUTCFullYear(), m = String(date.getUTCMonth() + 1).padStart(2, "0"), d = String(date.getUTCDate()).padStart(2, "0"); return `${y}${m}${d}`; }
function safeRunId(value) { if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) throw Object.assign(new Error("run id must match ^[a-z0-9][a-z0-9._-]*$"), { code: "EXE001_RUN" }); return value; }
function ensureInside(runDir, candidate) {
  const root = resolve(runDir), absolute = resolve(candidate), rel = relative(root, absolute);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) return { absolute, relative: rel.replaceAll(sep, "/") || "." };
  throw Object.assign(new Error(`path escapes run directory: ${candidate}`), { code: "EXE010_PATH" });
}
async function fileDescriptor(path) { const bytes = await readFile(path), info = await stat(path); if (!info.isFile()) throw new Error(`not a regular file: ${path}`); return { sha256: sha256Text(bytes), bytes: bytes.length }; }
async function descriptorForRunPath(runDir, path) { const rooted = ensureInside(runDir, isAbsolute(path) ? path : join(runDir, path)); const descriptor = await fileDescriptor(rooted.absolute); return { path: rooted.relative, ...descriptor }; }
async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
async function writeImmutableJson(path, value) {
  await mkdir(dirname(path), { recursive: true }); const text = `${JSON.stringify(value, null, 2)}\n`;
  try { await writeFile(path, text, { encoding: "utf8", flag: "wx" }); }
  catch (error) { if (error?.code !== "EEXIST") throw error; const existing = await readFile(path, "utf8"); if (existing !== text) throw Object.assign(new Error(`immutable execution record already exists with different bytes: ${path}`), { code: "EXE003_RECEIPT" }); }
}
async function writeManifest(runDir, manifest) {
  const base = structuredClone(manifest); delete base.run_hash; const next = { ...base, run_hash: sha256Canonical(base) };
  const target = join(runDir, "run.json"), temp = join(runDir, "tmp", `run-${process.pid}.json`); await writeJson(temp, next); await rename(temp, target); return deepFreeze(next);
}
async function acquireLock(runDir, operation) {
  const path = join(runDir, LOCK_FILE);
  try { const handle = await open(path, "wx"); await handle.writeFile(`${JSON.stringify({ pid: process.pid, operation, engine_version: EXECUTION_ENGINE_VERSION })}\n`); await handle.close(); return async () => { try { await unlink(path); } catch {} }; }
  catch (error) { if (error?.code === "EEXIST") throw Object.assign(new Error(`writer lock already exists: ${path}`), { code: "EXE007_LOCK" }); throw error; }
}
function defaultMaps(value) { return Object.fromEntries(EXECUTION_STAGES.map((stage) => [stage.id, value])); }
function manifestShapeValid(manifest) { return manifest?.schema_version === RUN_SCHEMA_VERSION && typeof manifest.run_id === "string" && Array.isArray(manifest.stage_order) && manifest.stage_order.join("|") === EXECUTION_STAGES.map((stage) => stage.id).join("|") && manifest.revisions && manifest.active_receipts && manifest.receipt_paths && typeof manifest.run_hash === "string"; }
function receiptShapeValid(receipt) { return receipt?.schema_version === STAGE_RECEIPT_SCHEMA_VERSION && receipt.status === "promoted" && typeof receipt.run_id === "string" && stageById(receipt.stage_id) && Number.isInteger(receipt.revision) && receipt.revision >= 1 && Array.isArray(receipt.artifacts) && receipt.artifacts.length >= 1 && Array.isArray(receipt.evidence) && receipt.evidence.length >= 1 && typeof receipt.receipt_hash === "string"; }
function checkpointShapeValid(checkpoint) { return checkpoint?.schema_version === CHECKPOINT_SCHEMA_VERSION && typeof checkpoint.run_id === "string" && Number.isInteger(checkpoint.sequence) && checkpoint.sequence >= 1 && typeof checkpoint.checkpoint_hash === "string"; }
async function verifyBoundFiles(runDir, receipt, issues) {
  for (const [kind, list, code] of [["artifact", receipt.artifacts, "EXE004_ARTIFACT"], ["evidence", receipt.evidence, "EXE005_EVIDENCE"]]) for (const entry of list) {
    try { const current = await descriptorForRunPath(runDir, entry.path); if (current.sha256 !== entry.sha256 || current.bytes !== entry.bytes) issues.push(issue(code, "error", `${kind} bytes no longer match promoted receipt`, { stage_id: receipt.stage_id, path: entry.path, expected_hash: entry.sha256, actual_hash: current.sha256 })); }
    catch (error) { issues.push(issue(error?.code === "EXE010_PATH" ? "EXE010_PATH" : code, "error", `${kind} cannot be verified: ${error.message}`, { stage_id: receipt.stage_id, path: entry.path })); }
  }
}
async function readAndVerifyReceipt(runDir, stage, manifest, predecessorHash) {
  const issues = [], receiptPath = manifest.receipt_paths[stage.id];
  if (!receiptPath) return { receipt: null, issues: [issue("EXE003_RECEIPT", "error", "active receipt path is missing", { stage_id: stage.id })] };
  try {
    const rooted = ensureInside(runDir, join(runDir, receiptPath)), receipt = await readJson(rooted.absolute);
    if (!receiptShapeValid(receipt)) issues.push(issue("EXE003_RECEIPT", "error", "receipt structure is invalid", { stage_id: stage.id, path: receiptPath }));
    else {
      if (hashBase(receipt, "receipt_hash") !== receipt.receipt_hash || receipt.receipt_hash !== manifest.active_receipts[stage.id]) issues.push(issue("EXE003_RECEIPT", "error", "receipt hash does not match active run state", { stage_id: stage.id, path: receiptPath }));
      if (receipt.run_id !== manifest.run_id || receipt.stage_id !== stage.id || receipt.revision !== manifest.revisions[stage.id]) issues.push(issue("EXE003_RECEIPT", "error", "receipt identity does not match run manifest", { stage_id: stage.id, path: receiptPath }));
      if ((receipt.predecessor_hash ?? null) !== (predecessorHash ?? null)) issues.push(issue("EXE003_RECEIPT", "error", "receipt predecessor chain is invalid", { stage_id: stage.id, path: receiptPath }));
      if (receipt.source_hash !== manifest.source.sha256) issues.push(issue("EXE002_SOURCE", "error", "receipt source hash diverges from the run source", { stage_id: stage.id }));
      if (sha256Canonical(receipt.artifacts) !== receipt.artifacts_hash) issues.push(issue("EXE003_RECEIPT", "error", "receipt artifact-set hash is invalid", { stage_id: stage.id }));
      if (sha256Canonical(receipt.evidence) !== receipt.evidence_hash) issues.push(issue("EXE003_RECEIPT", "error", "receipt evidence-set hash is invalid", { stage_id: stage.id }));
      await verifyBoundFiles(runDir, receipt, issues);
    }
    return { receipt, issues: sortIssues(issues) };
  } catch (error) { return { receipt: null, issues: [issue(error?.code === "EXE010_PATH" ? "EXE010_PATH" : "EXE003_RECEIPT", "error", `receipt cannot be read: ${error.message}`, { stage_id: stage.id, path: receiptPath })] }; }
}
async function verifyCheckpoint(runDir, manifest) {
  if (!manifest.latest_checkpoint) return manifest.checkpoint_sequence === 0 ? [] : [issue("EXE008_CHECKPOINT", "error", "checkpoint sequence is nonzero without an active checkpoint")];
  try {
    const rooted = ensureInside(runDir, join(runDir, manifest.latest_checkpoint.path)), checkpoint = await readJson(rooted.absolute);
    if (!checkpointShapeValid(checkpoint)) return [issue("EXE008_CHECKPOINT", "error", "checkpoint structure is invalid", { path: manifest.latest_checkpoint.path })];
    const issues = [];
    if (hashBase(checkpoint, "checkpoint_hash") !== checkpoint.checkpoint_hash || checkpoint.checkpoint_hash !== manifest.latest_checkpoint.hash) issues.push(issue("EXE008_CHECKPOINT", "error", "checkpoint hash does not match run manifest", { path: manifest.latest_checkpoint.path }));
    if (checkpoint.run_id !== manifest.run_id || checkpoint.sequence !== manifest.checkpoint_sequence) issues.push(issue("EXE008_CHECKPOINT", "error", "checkpoint identity does not match run manifest", { path: manifest.latest_checkpoint.path }));
    if (sha256Canonical(checkpoint.active_receipts) !== sha256Canonical(manifest.active_receipts) || sha256Canonical(checkpoint.revisions) !== sha256Canonical(manifest.revisions) || checkpoint.frontier_stage !== firstFrontier(manifest)) issues.push(issue("EXE008_CHECKPOINT", "error", "checkpoint snapshot does not match active run state", { path: manifest.latest_checkpoint.path }));
    return sortIssues(issues);
  } catch (error) { return [issue(error?.code === "EXE010_PATH" ? "EXE010_PATH" : "EXE008_CHECKPOINT", "error", `checkpoint cannot be verified: ${error.message}`, { path: manifest.latest_checkpoint.path })]; }
}

export async function verifyWorkspace(runDir) {
  const root = resolve(runDir), issues = []; let manifest;
  try { manifest = await readJson(join(root, "run.json")); } catch (error) { return { status: "fail", valid: false, frontier_stage: "understanding", issues: [issue("EXE001_RUN", "error", `run manifest cannot be read: ${error.message}`)] }; }
  if (!manifestShapeValid(manifest)) issues.push(issue("EXE001_RUN", "error", "run manifest structure or stage order is invalid")); else if (hashBase(manifest, "run_hash") !== manifest.run_hash) issues.push(issue("EXE001_RUN", "error", "run manifest hash is invalid"));
  if (issues.length) return { status: "fail", valid: false, run_id: manifest?.run_id, frontier_stage: "understanding", issues: sortIssues(issues) };
  try { const source = await descriptorForRunPath(root, manifest.source.path); if (source.sha256 !== manifest.source.sha256 || source.bytes !== manifest.source.bytes) issues.push(issue("EXE002_SOURCE", "error", "run source bytes no longer match intake provenance", { path: manifest.source.path })); }
  catch (error) { issues.push(issue(error?.code === "EXE010_PATH" ? "EXE010_PATH" : "EXE002_SOURCE", "error", `run source cannot be verified: ${error.message}`, { path: manifest.source.path })); }
  let predecessorHash = null, earliestInvalid = issues.length ? "understanding" : null;
  for (const stage of EXECUTION_STAGES) {
    const activeHash = manifest.active_receipts[stage.id];
    if (!activeHash) { for (const later of EXECUTION_STAGES.slice(stage.ordinal)) if (manifest.active_receipts[later.id]) issues.push(issue("EXE006_FRONTIER", "error", "a descendant stage is active after a frontier gap", { stage_id: later.id })); break; }
    const verified = await readAndVerifyReceipt(root, stage, manifest, predecessorHash); issues.push(...verified.issues); if (verified.issues.some((entry) => entry.severity === "error") && !earliestInvalid) earliestInvalid = stage.id; predecessorHash = activeHash;
  }
  const checkpointIssues = await verifyCheckpoint(root, manifest); issues.push(...checkpointIssues); if (checkpointIssues.some((entry) => entry.severity === "error") && !earliestInvalid) earliestInvalid = firstFrontier(manifest) ?? "export";
  const sorted = sortIssues(issues), valid = !sorted.some((entry) => entry.severity === "error");
  return { status: valid ? "pass" : "fail", valid, run_id: manifest.run_id, run_hash: manifest.run_hash, frontier_stage: earliestInvalid ?? firstFrontier(manifest), reopen_required_stage: earliestInvalid, complete: valid && firstFrontier(manifest) === null, issues: sorted };
}

async function createCheckpoint(runDir, manifest, reason) {
  const sequence = manifest.checkpoint_sequence + 1, base = { schema_version: CHECKPOINT_SCHEMA_VERSION, run_id: manifest.run_id, sequence, reason, frontier_stage: firstFrontier(manifest), active_receipts: structuredClone(manifest.active_receipts), revisions: structuredClone(manifest.revisions), previous_checkpoint_hash: manifest.latest_checkpoint?.hash ?? null }, checkpoint = { ...base, checkpoint_hash: sha256Canonical(base) };
  const path = `checkpoints/${checkpointName(sequence, checkpoint.checkpoint_hash)}`; await writeImmutableJson(join(runDir, path), checkpoint); manifest.checkpoint_sequence = sequence; manifest.latest_checkpoint = { path, hash: checkpoint.checkpoint_hash }; return checkpoint;
}

export async function initializeWorkspace(rootDir, sourcePath, options = {}) {
  await mkdir(resolve(rootDir), { recursive: true });
  const sourceAbsolute = resolve(sourcePath), sourceBytes = await readFile(sourceAbsolute), sourceHash = sha256Text(sourceBytes), sourceExt = extname(sourceAbsolute), runId = safeRunId(options.runId ?? `run-${sourceDateStamp()}-${sourceHash.slice(7, 15)}`), runDir = resolve(rootDir, runId);
  await mkdir(runDir, { recursive: false }); const release = await acquireLock(runDir, "init");
  try {
    for (const dir of ["intake", "receipts", "checkpoints", "evidence", "logs", "final", "tmp", "stages"]) await mkdir(join(runDir, dir), { recursive: true });
    for (const stage of EXECUTION_STAGES) await mkdir(join(runDir, "stages", stage.dir), { recursive: true });
    const intakeName = `source${sourceExt || ".bin"}`; await copyFile(sourceAbsolute, join(runDir, "intake", intakeName));
    const manifest = { schema_version: RUN_SCHEMA_VERSION, engine_version: EXECUTION_ENGINE_VERSION, run_id: runId, source: { path: `intake/${intakeName}`, original_name: basename(sourceAbsolute), sha256: sourceHash, bytes: sourceBytes.length }, stage_order: EXECUTION_STAGES.map((stage) => stage.id), revisions: defaultMaps(0), active_receipts: defaultMaps(null), receipt_paths: defaultMaps(null), invalidations: [], checkpoint_sequence: 0, latest_checkpoint: null, status: "active" };
    manifest.revisions.understanding = 1; await mkdir(join(runDir, "stages", EXECUTION_STAGES[0].dir, padRevision(1)), { recursive: true }); await createCheckpoint(runDir, manifest, "init"); const written = await writeManifest(runDir, manifest);
    return deepFreeze({ status: "pass", run_dir: runDir, run_id: runId, source_hash: sourceHash, frontier_stage: "understanding", revision_dir: `stages/${EXECUTION_STAGES[0].dir}/${padRevision(1)}`, run_hash: written.run_hash });
  } finally { await release(); }
}
async function loadVerifiedForWrite(runDir, operation) { const verification = await verifyWorkspace(runDir); if (!verification.valid) throw Object.assign(new Error(`workspace verification failed before ${operation}`), { code: verification.issues[0]?.code ?? "EXE001_RUN", verification }); const manifest = await readJson(join(runDir, "run.json")); return { verification, manifest }; }

export async function promoteStage(runDir, stageId, input) {
  const root = resolve(runDir), stage = stageById(stageId); if (!stage) throw Object.assign(new Error(`unknown execution stage: ${stageId}`), { code: "EXE006_FRONTIER" }); const release = await acquireLock(root, `promote:${stageId}`);
  try {
    const { manifest } = await loadVerifiedForWrite(root, `promote ${stageId}`), frontier = firstFrontier(manifest); if (frontier !== stageId) throw Object.assign(new Error(`stage ${stageId} is not the active frontier (${frontier ?? "complete"})`), { code: "EXE006_FRONTIER" });
    const revision = manifest.revisions[stageId] || 1, revisionDir = `stages/${stage.dir}/${padRevision(revision)}`; await mkdir(join(root, revisionDir), { recursive: true });
    const artifactPaths = [...new Set(input?.artifacts ?? [])].sort(), evidencePaths = [...new Set(input?.evidence ?? [])].sort(); if (!artifactPaths.length) throw Object.assign(new Error("stage promotion requires at least one artifact"), { code: "EXE004_ARTIFACT" }); if (!evidencePaths.length) throw Object.assign(new Error("stage promotion requires at least one evidence file"), { code: "EXE005_EVIDENCE" });
    const artifacts = await Promise.all(artifactPaths.map((path) => descriptorForRunPath(root, path))), evidence = await Promise.all(evidencePaths.map((path) => descriptorForRunPath(root, path)));
    for (const entry of artifacts) { const inRevision = entry.path === revisionDir || entry.path.startsWith(`${revisionDir}/`), inFinal = stageId === "export" && entry.path.startsWith("final/"); if (!inRevision && !inFinal) throw Object.assign(new Error(`stage artifact must live under active revision directory ${revisionDir}${stageId === "export" ? " or final/" : ""}: ${entry.path}`), { code: "EXE010_PATH" }); }
    const predecessor = stage.ordinal === 1 ? null : manifest.active_receipts[EXECUTION_STAGES[stage.ordinal - 2].id], authorityEntries = Object.entries(input?.authority_hashes ?? {}).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of authorityEntries) if (!/^[a-z][a-z0-9._-]*$/.test(key) || !/^sha256:[0-9a-f]{64}$/.test(value)) throw Object.assign(new Error(`invalid authority hash binding: ${key}`), { code: "EXE003_RECEIPT" });
    const base = { schema_version: STAGE_RECEIPT_SCHEMA_VERSION, engine_version: EXECUTION_ENGINE_VERSION, run_id: manifest.run_id, stage_id: stage.id, revision, status: "promoted", source_hash: manifest.source.sha256, predecessor_hash: predecessor, artifacts, artifacts_hash: sha256Canonical(artifacts), evidence, evidence_hash: sha256Canonical(evidence), authority_hashes: Object.fromEntries(authorityEntries) }, receipt = deepFreeze({ ...base, receipt_hash: sha256Canonical(base) }), receiptPath = `receipts/${stage.dir}/${padRevision(revision)}-${receipt.receipt_hash.slice(7, 15)}.json`;
    await writeImmutableJson(join(root, receiptPath), receipt); manifest.active_receipts[stageId] = receipt.receipt_hash; manifest.receipt_paths[stageId] = receiptPath;
    const next = EXECUTION_STAGES[stage.ordinal]; if (next) { if (manifest.revisions[next.id] === 0) manifest.revisions[next.id] = 1; await mkdir(join(root, "stages", next.dir, padRevision(manifest.revisions[next.id])), { recursive: true }); manifest.status = "active"; } else manifest.status = "complete";
    const checkpoint = await createCheckpoint(root, manifest, `promote:${stageId}`), written = await writeManifest(root, manifest); return deepFreeze({ status: "pass", promoted: true, stage_id: stageId, revision, receipt, receipt_path: receiptPath, checkpoint_hash: checkpoint.checkpoint_hash, frontier_stage: firstFrontier(written), complete: written.status === "complete", run_hash: written.run_hash });
  } finally { await release(); }
}

export async function reopenStage(runDir, stageId, reason) {
  const root = resolve(runDir), stage = stageById(stageId); if (!stage) throw Object.assign(new Error(`unknown execution stage: ${stageId}`), { code: "EXE009_REOPEN" }); if (typeof reason !== "string" || !reason.trim()) throw Object.assign(new Error("reopen requires a non-empty reason"), { code: "EXE009_REOPEN" }); const release = await acquireLock(root, `reopen:${stageId}`);
  try {
    const verification = await verifyWorkspace(root); let manifest; try { manifest = await readJson(join(root, "run.json")); } catch (error) { throw Object.assign(new Error(`run manifest cannot be read for reopen: ${error.message}`), { code: "EXE001_RUN" }); }
    if (!manifestShapeValid(manifest) || hashBase(manifest, "run_hash") !== manifest.run_hash) throw Object.assign(new Error("run manifest is not trustworthy enough to reopen"), { code: "EXE001_RUN" });
    const fatal = verification.issues.find((entry) => entry.code === "EXE001_RUN" || entry.code === "EXE002_SOURCE"); if (fatal) throw Object.assign(new Error(`workspace provenance must be restored before reopen: ${fatal.message}`), { code: fatal.code, verification });
    if (!verification.valid) { const earliest = verification.reopen_required_stage; if (!earliest || stageIndex(stageId) > stageIndex(earliest)) throw Object.assign(new Error(`reopen must start at or before earliest invalid stage ${earliest ?? "unknown"}`), { code: "EXE009_REOPEN", verification }); }
    if (!manifest.active_receipts[stageId]) throw Object.assign(new Error(`stage ${stageId} has no active promoted receipt to reopen`), { code: "EXE009_REOPEN" });
    const nextRevision = manifest.revisions[stageId] + 1, invalidated = [];
    for (const target of EXECUTION_STAGES.slice(stage.ordinal - 1)) { const previousHash = manifest.active_receipts[target.id]; if (previousHash) { invalidated.push({ stage_id: target.id, receipt_hash: previousHash, receipt_path: manifest.receipt_paths[target.id], reopened_stage: stageId, reopen_revision: nextRevision, reason: reason.trim() }); manifest.active_receipts[target.id] = null; manifest.receipt_paths[target.id] = null; } }
    manifest.invalidations.push(...invalidated); manifest.revisions[stageId] = nextRevision; for (const target of EXECUTION_STAGES.slice(stage.ordinal)) manifest.revisions[target.id] = 0; await mkdir(join(root, "stages", stage.dir, padRevision(nextRevision)), { recursive: true }); manifest.status = "active";
    const checkpoint = await createCheckpoint(root, manifest, `reopen:${stageId}`), written = await writeManifest(root, manifest); return deepFreeze({ status: "pass", reopened: true, stage_id: stageId, revision: nextRevision, revision_dir: `stages/${stage.dir}/${padRevision(nextRevision)}`, invalidated, checkpoint_hash: checkpoint.checkpoint_hash, run_hash: written.run_hash });
  } finally { await release(); }
}

export async function createWorkspaceCheckpoint(runDir, reason = "manual") { const root = resolve(runDir), release = await acquireLock(root, "checkpoint"); try { const { manifest } = await loadVerifiedForWrite(root, "checkpoint"), checkpoint = await createCheckpoint(root, manifest, reason), written = await writeManifest(root, manifest); return deepFreeze({ status: "pass", checkpoint, run_hash: written.run_hash }); } finally { await release(); } }
export async function resumeWorkspace(runDir) {
  const root = resolve(runDir), verification = await verifyWorkspace(root); let manifest = null; try { manifest = await readJson(join(root, "run.json")); } catch {}
  if (!verification.valid) return deepFreeze({ status: "reopen-required", run_id: manifest?.run_id ?? null, reopen_required_stage: verification.reopen_required_stage ?? "understanding", issues: verification.issues });
  const frontier = firstFrontier(manifest); if (!frontier) return deepFreeze({ status: "complete", run_id: manifest.run_id, run_hash: manifest.run_hash, source: manifest.source, latest_checkpoint: manifest.latest_checkpoint, active_receipts: manifest.active_receipts, issues: [] });
  const stage = stageById(frontier), revision = manifest.revisions[frontier] || 1; return deepFreeze({ status: "ready", run_id: manifest.run_id, run_hash: manifest.run_hash, source: manifest.source, frontier_stage: frontier, revision, revision_dir: `stages/${stage.dir}/${padRevision(revision)}`, predecessor_receipt_hash: stage.ordinal === 1 ? null : manifest.active_receipts[EXECUTION_STAGES[stage.ordinal - 2].id], latest_checkpoint: manifest.latest_checkpoint, active_receipts: manifest.active_receipts, issues: [] });
}
export async function recoverWriterLock(runDir, reason) {
  const root = resolve(runDir), path = join(root, LOCK_FILE); if (typeof reason !== "string" || !reason.trim()) throw Object.assign(new Error("lock recovery requires a non-empty reason"), { code: "EXE007_LOCK" }); let prior;
  try { prior = JSON.parse(await readFile(path, "utf8")); } catch (error) { if (error?.code === "ENOENT") return { status: "pass", recovered: false, message: "no writer lock exists" }; throw error; }
  const recordBase = { schema_version: "figthread.lock-recovery/0.1", prior, reason: reason.trim() }, record = { ...recordBase, recovery_hash: sha256Canonical(recordBase) }; await mkdir(join(root, "logs"), { recursive: true }); await writeImmutableJson(join(root, "logs", `lock-recovery-${record.recovery_hash.slice(7, 15)}.json`), record); await unlink(path); return deepFreeze({ status: "pass", recovered: true, recovery_hash: record.recovery_hash });
}
