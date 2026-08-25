import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { validateStructure } from "./schema-validator.js";

export const MOTION_ENGINE_VERSION = "0.1.0";
export const MOTION_SPEC_SCHEMA_VERSION = "figthread.motion/0.1";
export const MOTION_PROGRAM_SCHEMA_VERSION = "figthread.motion-program/0.1";

const schemaUrl = new URL("../schemas/motion-spec.schema.json", import.meta.url);
const MOTION_SCHEMA = JSON.parse(readFileSync(fileURLToPath(schemaUrl), "utf8"));
const severityOrder = { error: 0, warning: 1, note: 2 };
const geometryKeys = new Set(["x", "y", "w", "h", "width", "height", "cx", "cy", "path", "path_d", "d", "points"]);
const numericDomains = new Set(["number", "count", "ratio"]);

function issue(code, severity, message, extra = {}) { return { code, severity, stage_owner: "motion", message, ...extra }; }
function sortIssues(issues) { return issues.sort((a,b) => severityOrder[a.severity]-severityOrder[b.severity] || a.code.localeCompare(b.code) || (a.object_id??"").localeCompare(b.object_id??"") || (a.path??"").localeCompare(b.path??"") || a.message.localeCompare(b.message)); }
function deepFreeze(value, seen = new Set()) { if (value === null || typeof value !== "object" || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) deepFreeze(child, seen); return Object.freeze(value); }
function sortedObject(entries) { return Object.fromEntries([...entries].sort(([a],[b])=>a.localeCompare(b))); }
function readPromotion(promotion) {
  if (!promotion?.promoted || !promotion.validated_figure || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt; const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  if (sha256Canonical(promotion.validated_figure) !== receipt.input_hash) return null;
  return { figure: promotion.validated_figure, figureHash: receipt.input_hash };
}
function readLayoutPromotion(promotion) {
  if (!promotion?.promoted || !promotion.resolved_layout || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt; const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  if (promotion.resolved_layout.layout_hash !== receipt.layout_hash) return null;
  if (promotion.resolved_layout.figure_hash !== receipt.figure_hash) return null;
  return { layout: promotion.resolved_layout, layoutHash: receipt.layout_hash, figureHash: receipt.figure_hash };
}
function findGeometry(value, path = "$", out = []) {
  if (Array.isArray(value)) { value.forEach((entry,index)=>findGeometry(entry, `${path}[${index}]`, out)); return out; }
  if (!value || typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (geometryKeys.has(key)) out.push(childPath);
    findGeometry(child, childPath, out);
  }
  return out;
}
function domainContains(stateSpec, value) {
  const domain = stateSpec.domain ?? {};
  if (domain.type === "boolean") return typeof value === "boolean";
  if (domain.type === "enum") return Array.isArray(domain.values) && domain.values.some(candidate => Object.is(candidate, value));
  if (!numericDomains.has(domain.type) || typeof value !== "number" || !Number.isFinite(value)) return false;
  if (domain.type === "count" && (!Number.isInteger(value) || value < 0)) return false;
  if (domain.min !== undefined && value < domain.min) return false;
  if (domain.max !== undefined && value > domain.max) return false;
  return true;
}
function scheduleFor(motion) {
  const eventById = new Map((motion.events ?? []).map(event => [event.id,event]));
  const scheduled = [];
  for (const beat of motion.timeline?.beats ?? []) {
    for (const eventId of beat.event_ids ?? []) {
      const event = eventById.get(eventId);
      if (event) scheduled.push({ beat, event });
    }
  }
  return scheduled.sort((a,b) => a.beat.at_ms-b.beat.at_ms || (a.beat.order??Number.MAX_SAFE_INTEGER)-(b.beat.order??Number.MAX_SAFE_INTEGER) || (a.event.order??Number.MAX_SAFE_INTEGER)-(b.event.order??Number.MAX_SAFE_INTEGER) || a.event.id.localeCompare(b.event.id));
}
function cueDuration(beat, cue) { return cue.duration_ms ?? Math.max(0, beat.duration_ms - (cue.start_offset_ms ?? 0)); }
function initialState(figure) { return sortedObject(figure.states.map(state => [state.id,state.initial])); }
function summaryState(figure, snapshotId) { const snapshot=figure.snapshots.find(entry=>entry.id===snapshotId); return snapshot ? sortedObject(Object.entries(snapshot.state_values)) : null; }

function validateMotion(figure, layout, motion) {
  const issues = validateStructure(motion, MOTION_SCHEMA).map(entry => issue("MOT001_BIND", "error", `motion document ${entry.path}: ${entry.message}`, { path: entry.path }));
  if (issues.length) return sortIssues(issues);
  if (motion.figure_id !== figure.id) issues.push(issue("MOT001_BIND", "error", `motion figure_id ${motion.figure_id} does not match promoted figure ${figure.id}`, { path: "$.figure_id" }));
  if (layout.figure_hash !== sha256Canonical(figure)) issues.push(issue("MOT001_BIND", "error", "resolved layout does not belong to the promoted figure"));

  const beatIds = new Set(), eventIds = new Set(), eventRefCount = new Map();
  for (const beat of motion.timeline.beats) {
    if (beatIds.has(beat.id)) issues.push(issue("MOT001_BIND", "error", `duplicate beat id ${beat.id}`, { object_id: beat.id }));
    beatIds.add(beat.id);
    if (beat.at_ms + beat.duration_ms > motion.timeline.duration_ms) issues.push(issue("MOT002_TIME", "error", `${beat.id} exceeds timeline duration`, { object_id: beat.id }));
    const localRefs = new Set();
    for (const eventId of beat.event_ids) {
      if (localRefs.has(eventId)) issues.push(issue("MOT001_BIND", "error", `${beat.id} references ${eventId} more than once`, { object_id: beat.id }));
      localRefs.add(eventId); eventRefCount.set(eventId,(eventRefCount.get(eventId)??0)+1);
    }
  }
  for (const event of motion.events) {
    if (eventIds.has(event.id)) issues.push(issue("MOT001_BIND", "error", `duplicate event id ${event.id}`, { object_id: event.id }));
    eventIds.add(event.id);
    if (!(event.effects?.length || event.cues?.length)) issues.push(issue("MOT005_CUE", "error", `${event.id} has no semantic effect or cue`, { object_id: event.id }));
  }
  for (const beat of motion.timeline.beats) for (const eventId of beat.event_ids) if (!eventIds.has(eventId)) issues.push(issue("MOT001_BIND", "error", `${beat.id} references unknown event ${eventId}`, { object_id: beat.id }));
  for (const event of motion.events) if ((eventRefCount.get(event.id)??0) !== 1) issues.push(issue("MOT001_BIND", "error", `${event.id} must be scheduled by exactly one beat`, { object_id: event.id }));

  for (const path of findGeometry(motion)) issues.push(issue("MOT004_GEOMETRY", "error", "MotionSpec cannot own resolved geometry", { path }));
  if (Object.keys(motion.extensions).length) issues.push(issue("MOT009_PURITY", "error", "no canonical motion extension compiler is registered in the installed runtime", { path: "$.extensions" }));

  const nodeIds = new Set(figure.nodes.map(node=>node.id)), relationIds = new Set(figure.relations.map(relation=>relation.id));
  const stateById = new Map(figure.states.map(state=>[state.id,state]));
  const scheduled = scheduleFor(motion);
  const state = new Map(Object.entries(initialState(figure)));
  const writerSlots = new Map();
  for (const {beat,event} of scheduled) {
    const effects = event.effects ?? [];
    for (const [effectIndex,effect] of effects.entries()) {
      const spec = stateById.get(effect.state_id);
      if (!spec) { issues.push(issue("MOT001_BIND", "error", `${event.id} references unknown state ${effect.state_id}`, { object_id: event.id, path: `effects[${effectIndex}]` })); continue; }
      const slot = `${beat.at_ms}\0${effect.state_id}`;
      const prior = writerSlots.get(slot);
      if (prior) issues.push(issue("MOT006_WRITER", "error", `${effect.state_id} has concurrent writers ${prior} and ${event.id} at ${beat.at_ms}ms`, { object_id: effect.state_id }));
      else writerSlots.set(slot,event.id);
      if (effect.op === "add" && !numericDomains.has(spec.domain.type)) { issues.push(issue("MOT003_DOMAIN", "error", "add is only valid for numeric/count/ratio state domains", { object_id: effect.state_id })); continue; }
      if (effect.op === "add" && (typeof effect.value !== "number" || !Number.isFinite(effect.value))) { issues.push(issue("MOT003_DOMAIN", "error", `add value for ${effect.state_id} must be a finite number`, { object_id: effect.state_id })); continue; }
      const current = state.get(effect.state_id); const next = effect.op === "add" ? current + effect.value : effect.value;
      if (!domainContains(spec,next)) issues.push(issue("MOT003_DOMAIN", "error", `${event.id} writes ${JSON.stringify(next)} outside ${effect.state_id} domain`, { object_id: effect.state_id }));
      else state.set(effect.state_id,next);
    }
    for (const [cueIndex,cue] of (event.cues ?? []).entries()) {
      const path = `event:${event.id}.cues[${cueIndex}]`, offset=cue.start_offset_ms??0, duration=cueDuration(beat,cue);
      if (offset + duration > beat.duration_ms) issues.push(issue("MOT002_TIME", "error", `${event.id} cue exceeds its beat window`, { object_id: event.id, path }));
      if (["reveal","focus","morph-state"].includes(cue.kind)) {
        if (!cue.target_id || !nodeIds.has(cue.target_id)) issues.push(issue("MOT005_CUE", "error", `${cue.kind} requires a valid node target_id`, { object_id: event.id, path }));
        else if (!layout.boxes[cue.target_id]) issues.push(issue("MOT004_GEOMETRY", "error", `layout has no box for ${cue.target_id}`, { object_id: cue.target_id }));
      } else if (cue.kind === "trace") {
        if (!cue.via_relation || !relationIds.has(cue.via_relation)) issues.push(issue("MOT005_CUE", "error", "trace requires a valid via_relation", { object_id: event.id, path }));
        else if (!layout.connectors[cue.via_relation]) issues.push(issue("MOT004_GEOMETRY", "error", `layout has no route for ${cue.via_relation}`, { object_id: cue.via_relation }));
      } else if (cue.kind === "transfer") {
        if (!cue.subject_id || !nodeIds.has(cue.subject_id)) issues.push(issue("MOT005_CUE", "error", "transfer requires a valid semantic subject_id", { object_id: event.id, path }));
        if (!cue.via_relation || !relationIds.has(cue.via_relation)) issues.push(issue("MOT005_CUE", "error", "transfer requires a valid via_relation", { object_id: event.id, path }));
        else if (!layout.connectors[cue.via_relation]) issues.push(issue("MOT004_GEOMETRY", "error", `layout has no route for ${cue.via_relation}`, { object_id: cue.via_relation }));
      }
    }
  }

  const loop = motion.timeline.loop;
  if ((loop.mode === "repeat") !== (loop.closure === "explicit-reset")) issues.push(issue("MOT007_LOOP", "error", "repeat loops require explicit-reset closure; non-repeat timelines require closure none", { path: "$.timeline.loop" }));
  if (loop.mode === "repeat") {
    const initial = initialState(figure); const finalState = sortedObject(state.entries());
    if (sha256Canonical(initial) !== sha256Canonical(finalState)) issues.push(issue("MOT007_LOOP", "error", "repeat timeline does not return semantic state to its initial values by duration_ms", { path: "$.timeline" }));
  }

  const staticState = summaryState(figure,motion.static_snapshot_id);
  if (!staticState || motion.static_snapshot_id !== figure.static_snapshot_id) issues.push(issue("MOT008_STATIC", "error", "motion static snapshot must resolve to the promoted figure static summary snapshot", { path: "$.static_snapshot_id" }));
  return sortIssues(issues);
}

function compileCue(layout, beat, cue) {
  const startMs=beat.at_ms+(cue.start_offset_ms??0), durationMs=cueDuration(beat,cue), base={kind:cue.kind,start_ms:startMs,duration_ms:durationMs,easing:cue.easing??"linear"};
  if (["reveal","focus","morph-state"].includes(cue.kind)) { const box=layout.boxes[cue.target_id]; return { ...base, target_id:cue.target_id, target_box:{x:box.x,y:box.y,w:box.w,h:box.h} }; }
  const route=layout.connectors[cue.via_relation];
  if (cue.kind === "trace") return { ...base, via_relation:cue.via_relation, path_d:route.path_d };
  return { ...base, subject_id:cue.subject_id, via_relation:cue.via_relation, start:{...route.points[0]}, path_d:route.path_d, end:{...route.points.at(-1)} };
}
function compileProgram(figure, layout, motion, figureHash, layoutHash) {
  const tracks=scheduleFor(motion).map(({beat,event})=>({ beat_id:beat.id,event_id:event.id,at_ms:beat.at_ms,duration_ms:beat.duration_ms,effects:structuredClone(event.effects??[]),cues:(event.cues??[]).map(cue=>compileCue(layout,beat,cue)) }));
  const base={schema_version:MOTION_PROGRAM_SCHEMA_VERSION,figure_hash:figureHash,layout_hash:layoutHash,motion_hash:sha256Canonical(motion),engine_version:MOTION_ENGINE_VERSION,duration_ms:motion.timeline.duration_ms,loop:structuredClone(motion.timeline.loop),initial_state:initialState(figure),static_snapshot_id:motion.static_snapshot_id,static_state:summaryState(figure,motion.static_snapshot_id),tracks};
  return deepFreeze({...base,program_hash:sha256Canonical(base)});
}

export function compilePromotedMotion(figurePromotion, layoutPromotion, motion, options = {}) {
  const mode=options.mode??"gate"; if(!["draft","gate"].includes(mode)) throw new TypeError("motion mode must be 'draft' or 'gate'");
  const promoted=readPromotion(figurePromotion), resolved=readLayoutPromotion(layoutPromotion);
  if(!promoted || !resolved || promoted.figureHash!==resolved.figureHash) { const issues=[issue("MOT001_BIND","error","motion compilation requires matching promoted semantic and layout artifacts")]; return {mode,status:"fail",promotion_eligible:false,motion_engine_version:MOTION_ENGINE_VERSION,issues}; }
  let motionHash; try { motionHash=sha256Canonical(motion); } catch { motionHash=undefined; }
  const issues=validateMotion(promoted.figure,resolved.layout,motion),hasErrors=issues.some(entry=>entry.severity==="error");
  if(hasErrors) return {figure_hash:promoted.figureHash,layout_hash:resolved.layoutHash,motion_hash:motionHash,mode,status:"fail",promotion_eligible:false,motion_engine_version:MOTION_ENGINE_VERSION,issues};
  const program=compileProgram(promoted.figure,resolved.layout,motion,promoted.figureHash,resolved.layoutHash);
  return {figure_hash:promoted.figureHash,layout_hash:resolved.layoutHash,motion_hash:motionHash,program_hash:program.program_hash,mode,status:issues.length?"pass-with-warnings":"pass",promotion_eligible:mode==="gate",motion_engine_version:MOTION_ENGINE_VERSION,issues,motion_program:program};
}
export function promoteMotionProgram(figurePromotion, layoutPromotion, motion) {
  const result=compilePromotedMotion(figurePromotion,layoutPromotion,motion,{mode:"gate"});
  if(!result.promotion_eligible) return {promoted:false,report:result};
  const receiptBase={kind:"motion_program",schema_version:MOTION_PROGRAM_SCHEMA_VERSION,figure_hash:result.figure_hash,layout_hash:result.layout_hash,motion_hash:result.motion_hash,program_hash:result.program_hash,engine_version:MOTION_ENGINE_VERSION};
  return {promoted:true,report:result,motion_program:result.motion_program,promotion_receipt:deepFreeze({...receiptBase,promotion_hash:sha256Canonical(receiptBase)})};
}
export function evaluateMotionProgram(program, timeMs) {
  if (!Number.isInteger(timeMs) || timeMs < 0) throw new TypeError("time_ms must be a non-negative integer");
  const duration=program.duration_ms, localTime=program.loop.mode==="repeat" ? timeMs%duration : Math.min(timeMs,duration), state=new Map(Object.entries(program.initial_state)), active=[];
  for (const track of program.tracks) {
    if (track.at_ms<=localTime) for (const effect of track.effects) state.set(effect.state_id,effect.op==="add"?state.get(effect.state_id)+effect.value:effect.value);
    for (const [index,cue] of track.cues.entries()) if (localTime>=cue.start_ms && localTime<cue.start_ms+cue.duration_ms) active.push({beat_id:track.beat_id,event_id:track.event_id,cue_index:index,...cue});
  }
  return deepFreeze({time_ms:localTime,state:sortedObject(state.entries()),active_cues:active});
}
export function getStaticMotionState(program) { return deepFreeze({snapshot_id:program.static_snapshot_id,state:structuredClone(program.static_state),active_cues:[]}); }
