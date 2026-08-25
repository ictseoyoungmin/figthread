import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { validateStructure } from "./schema-validator.js";

export const VISUAL_ENGINE_VERSION = "0.1.0";
export const VISUAL_SPEC_SCHEMA_VERSION = "figthread.visual/0.1";
export const PRIMITIVE_PLAN_SCHEMA_VERSION = "figthread.primitive-plan/0.1";

const visualSchemaUrl = new URL("../schemas/visual-spec.schema.json", import.meta.url);
const primitiveSchemaUrl = new URL("../schemas/primitive-definition.schema.json", import.meta.url);
const registryUrl = new URL("../primitives/registry.json", import.meta.url);
const VISUAL_SCHEMA = JSON.parse(readFileSync(fileURLToPath(visualSchemaUrl), "utf8"));
const PRIMITIVE_SCHEMA = JSON.parse(readFileSync(fileURLToPath(primitiveSchemaUrl), "utf8"));
const CORE_REGISTRY = JSON.parse(readFileSync(fileURLToPath(registryUrl), "utf8"));
const severityOrder = { error: 0, warning: 1, note: 2 };

function issue(code, severity, message, extra = {}) { return { code, severity, stage_owner: "visual", message, ...extra }; }
function sortIssues(issues) { return issues.sort((a,b) => severityOrder[a.severity]-severityOrder[b.severity] || a.code.localeCompare(b.code) || (a.object_id??"").localeCompare(b.object_id??"") || (a.path??"").localeCompare(b.path??"") || a.message.localeCompare(b.message)); }
function deepFreeze(value, seen = new Set()) { if (value === null || typeof value !== "object" || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) deepFreeze(child, seen); return Object.freeze(value); }
function sortedObject(entries) { return Object.fromEntries([...entries].sort(([a],[b])=>a.localeCompare(b))); }
function duplicateValues(values) { const seen=new Set(),dupes=new Set(); for(const value of values){ if(seen.has(value))dupes.add(value); else seen.add(value); } return [...dupes].sort(); }
function registryBase(registry) { return { schema_version: registry.schema_version, definitions: registry.definitions }; }

export const PRIMITIVE_REGISTRY_HASH = CORE_REGISTRY.registry_hash;
const computedRegistryHash = sha256Canonical(registryBase(CORE_REGISTRY));
if (computedRegistryHash !== PRIMITIVE_REGISTRY_HASH) throw new Error("bundled primitive registry hash mismatch");

function readFigurePromotion(promotion) {
  if (!promotion?.promoted || !promotion.validated_figure || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt; const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  if (sha256Canonical(promotion.validated_figure) !== receipt.input_hash) return null;
  return { figure: promotion.validated_figure, figureHash: receipt.input_hash };
}

function unsafeSvg(svg) {
  const checks = [/<\s*script\b/i, /<\s*foreignObject\b/i, /\son[a-z]+\s*=/i, /(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/)/i, /url\(\s*["']?\s*(?:https?:|\/\/)/i];
  return checks.some((pattern) => pattern.test(svg));
}

function validateDefinition(definition, path, issues) {
  for (const entry of validateStructure(definition, PRIMITIVE_SCHEMA)) issues.push(issue("PRM009_CUSTOM", "error", `custom primitive ${entry.path}: ${entry.message}`, { path: `${path}${entry.path.slice(1)}` }));
  if (!definition || typeof definition !== "object") return;
  const intrinsic=definition.intrinsic;
  if (intrinsic && (intrinsic.pref_w < intrinsic.min_w || intrinsic.pref_h < intrinsic.min_h)) issues.push(issue("PRM004_INTRINSIC","error",`${definition.id ?? "custom primitive"} preferred size cannot be smaller than minimum size`,{object_id:definition.id,path:`${path}.intrinsic`}));
  for (const [field, values] of [["variants",definition.variants],["ports",definition.ports],["slots",definition.slots],["state_channels",definition.state_channels],["tokens",definition.tokens]]) for (const duplicate of duplicateValues(values ?? [])) issues.push(issue("PRM005_INTERFACE","error",`${definition.id ?? "custom primitive"} repeats ${field} value ${duplicate}`,{object_id:definition.id,path:`${path}.${field}`}));
  if (typeof definition.local_svg === "string" && unsafeSvg(definition.local_svg)) issues.push(issue("PRM008_PURITY","error",`${definition.id ?? "custom primitive"} local_svg contains executable or external content`,{object_id:definition.id,path:`${path}.local_svg`}));
}

function validateVisual(figure, visual) {
  const issues=validateStructure(visual,VISUAL_SCHEMA).map(entry=>issue("PRM001_BIND","error",`visual document ${entry.path}: ${entry.message}`,{path:entry.path}));
  if (issues.length) return sortIssues(issues);
  if (visual.figure_id !== figure.id) issues.push(issue("PRM001_BIND","error",`visual figure_id ${visual.figure_id} does not match promoted figure ${figure.id}`,{path:"$.figure_id"}));
  if (visual.registry_hash !== PRIMITIVE_REGISTRY_HASH) issues.push(issue("PRM002_REGISTRY","error","visual registry_hash does not match the installed core primitive registry",{path:"$.registry_hash"}));
  if (Object.keys(visual.extensions).length) issues.push(issue("PRM008_PURITY","error","no canonical visual extension compiler is registered in the installed runtime",{path:"$.extensions"}));

  const nodeById=new Map(figure.nodes.map(node=>[node.id,node]));
  const stateById=new Map(figure.states.map(state=>[state.id,state]));
  const customById=new Map();
  for (const [index,definition] of visual.custom_definitions.entries()) {
    validateDefinition(definition,`$.custom_definitions[${index}]`,issues);
    if (customById.has(definition.id) || CORE_REGISTRY.definitions.some(entry=>entry.id===definition.id)) issues.push(issue("PRM009_CUSTOM","error",`duplicate or shadowing custom primitive ${definition.id}`,{object_id:definition.id}));
    else customById.set(definition.id,definition);
  }
  const coreById=new Map(CORE_REGISTRY.definitions.map(definition=>[definition.id,definition]));
  const bindingByNode=new Map();
  for (const [index,binding] of visual.bindings.entries()) {
    const path=`$.bindings[${index}]`;
    if (!nodeById.has(binding.node_id)) issues.push(issue("PRM001_BIND","error",`binding references unknown node ${binding.node_id}`,{object_id:binding.node_id,path:`${path}.node_id`}));
    if (bindingByNode.has(binding.node_id)) issues.push(issue("PRM010_COVERAGE","error",`node ${binding.node_id} has more than one primitive binding`,{object_id:binding.node_id,path}));
    else bindingByNode.set(binding.node_id,binding);
    const definition=coreById.get(binding.primitive) ?? customById.get(binding.primitive);
    if (!definition) { issues.push(issue("PRM002_REGISTRY","error",`unknown primitive ${binding.primitive}`,{object_id:binding.node_id,path:`${path}.primitive`})); continue; }
    if (!(definition.variants ?? []).includes(binding.variant)) issues.push(issue("PRM003_VARIANT","error",`${binding.primitive} does not define variant ${binding.variant}`,{object_id:binding.node_id,path:`${path}.variant`}));
    const intrinsic=definition.intrinsic;
    if (!intrinsic || intrinsic.min_w<=0 || intrinsic.min_h<=0 || intrinsic.pref_w<intrinsic.min_w || intrinsic.pref_h<intrinsic.min_h) issues.push(issue("PRM004_INTRINSIC","error",`${binding.primitive} has invalid intrinsic metrics`,{object_id:binding.node_id}));
    if (binding.salience === "S3" && !binding.primitive.startsWith("custom.")) issues.push(issue("PRM007_SALIENCE","error",`${binding.node_id} is thesis-bearing/novel and requires a custom primitive`,{object_id:binding.node_id,path:`${path}.salience`}));
    const channels=new Set(definition.state_channels ?? []);
    for (const [channel,stateId] of Object.entries(binding.state_bindings)) {
      if (!channels.has(channel)) issues.push(issue("PRM006_STATE","error",`${binding.primitive} does not expose state channel ${channel}`,{object_id:binding.node_id,path:`${path}.state_bindings.${channel}`}));
      const state=stateById.get(stateId);
      if (!state) issues.push(issue("PRM006_STATE","error",`state binding ${channel} references unknown state ${stateId}`,{object_id:binding.node_id,path:`${path}.state_bindings.${channel}`}));
      else if (state.target_id !== binding.node_id) issues.push(issue("PRM006_STATE","error",`state ${stateId} targets ${state.target_id}, not bound node ${binding.node_id}`,{object_id:binding.node_id,path:`${path}.state_bindings.${channel}`}));
    }
  }
  for (const node of figure.nodes) if (!bindingByNode.has(node.id)) issues.push(issue("PRM010_COVERAGE","error",`semantic node ${node.id} has no primitive binding`,{object_id:node.id}));
  const usedCustom=new Set(visual.bindings.filter(binding=>binding.primitive.startsWith("custom.")).map(binding=>binding.primitive));
  for (const id of [...customById.keys()].sort()) if (!usedCustom.has(id)) issues.push(issue("PRM009_CUSTOM","warning",`custom primitive ${id} is defined but unused`,{object_id:id}));
  return sortIssues(issues);
}

function compilePlan(figure, figureHash, visual) {
  const customById=new Map(visual.custom_definitions.map(definition=>[definition.id,definition]));
  const coreById=new Map(CORE_REGISTRY.definitions.map(definition=>[definition.id,definition]));
  const rootId=figure.composition.root_id;
  const bindings=[];
  const measurements=[];
  for (const binding of [...visual.bindings].sort((a,b)=>a.node_id.localeCompare(b.node_id))) {
    const definition=coreById.get(binding.primitive) ?? customById.get(binding.primitive);
    const resolved={
      node_id:binding.node_id,
      primitive_id:definition.id,
      source:definition.id.startsWith("core.")?"core":"custom",
      class:definition.class,
      variant:binding.variant,
      salience:binding.salience,
      props:structuredClone(binding.props),
      state_bindings:sortedObject(Object.entries(binding.state_bindings)),
      view_box:structuredClone(definition.view_box),
      intrinsic:structuredClone(definition.intrinsic),
      ports:[...definition.ports],
      slots:[...definition.slots],
      state_channels:[...definition.state_channels],
      tokens:[...definition.tokens]
    };
    if (definition.local_svg !== undefined) resolved.local_svg=definition.local_svg;
    bindings.push(resolved);
    if (binding.node_id !== rootId) measurements.push({node_id:binding.node_id,min_w:definition.intrinsic.min_w,min_h:definition.intrinsic.min_h,pref_w:definition.intrinsic.pref_w,pref_h:definition.intrinsic.pref_h});
  }
  measurements.sort((a,b)=>a.node_id.localeCompare(b.node_id));
  const visualHash=sha256Canonical(visual), intrinsicMetricsHash=sha256Canonical(measurements);
  const base={schema_version:PRIMITIVE_PLAN_SCHEMA_VERSION,figure_hash:figureHash,visual_hash:visualHash,registry_hash:PRIMITIVE_REGISTRY_HASH,engine_version:VISUAL_ENGINE_VERSION,bindings,measurements,intrinsic_metrics_hash:intrinsicMetricsHash};
  return deepFreeze({...base,plan_hash:sha256Canonical(base)});
}

export function validateVisualSpec(figurePromotion, visual, options = {}) {
  const mode=options.mode??"gate"; if(!["draft","gate"].includes(mode)) throw new TypeError("visual mode must be 'draft' or 'gate'");
  const promoted=readFigurePromotion(figurePromotion);
  if (!promoted) return {mode,status:"fail",promotion_eligible:false,visual_engine_version:VISUAL_ENGINE_VERSION,registry_hash:PRIMITIVE_REGISTRY_HASH,issues:[issue("PRM001_BIND","error","visual validation requires a valid promoted semantic figure",{stage_owner:"semantic"})]};
  let visualHash; try { visualHash=sha256Canonical(visual); } catch { visualHash=undefined; }
  const issues=validateVisual(promoted.figure,visual),hasErrors=issues.some(entry=>entry.severity==="error");
  const result={figure_hash:promoted.figureHash,visual_hash:visualHash,registry_hash:PRIMITIVE_REGISTRY_HASH,mode,status:hasErrors?"fail":issues.length?"pass-with-warnings":"pass",promotion_eligible:mode==="gate"&&!hasErrors,visual_engine_version:VISUAL_ENGINE_VERSION,issues};
  if (!hasErrors) { const plan=compilePlan(promoted.figure,promoted.figureHash,visual); result.primitive_plan=plan; result.primitive_plan_hash=plan.plan_hash; result.intrinsic_metrics_hash=plan.intrinsic_metrics_hash; }
  return result;
}

export function promoteVisualSpec(figurePromotion, visual) {
  const result=validateVisualSpec(figurePromotion,visual,{mode:"gate"});
  if(!result.promotion_eligible)return{promoted:false,report:result};
  const validatedVisual=deepFreeze(structuredClone(visual)),plan=result.primitive_plan;
  const receiptBase={kind:"primitive_plan",schema_version:PRIMITIVE_PLAN_SCHEMA_VERSION,figure_hash:result.figure_hash,visual_hash:result.visual_hash,registry_hash:result.registry_hash,primitive_plan_hash:plan.plan_hash,intrinsic_metrics_hash:plan.intrinsic_metrics_hash,engine_version:VISUAL_ENGINE_VERSION};
  return {promoted:true,report:result,validated_visual:validatedVisual,primitive_plan:plan,promotion_receipt:deepFreeze({...receiptBase,promotion_hash:sha256Canonical(receiptBase)})};
}
