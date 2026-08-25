import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { validateStructure } from "./schema-validator.js";
import { compilePromotedLayout, LAYOUT_ENGINE_VERSION } from "./layout.js";

export const LAYOUT_TARGET_SCHEMA_VERSION = "figthread.layout-target/0.1";
const targetSchemaUrl=new URL("../schemas/layout-target.schema.json",import.meta.url);
const TARGET_SCHEMA=JSON.parse(readFileSync(fileURLToPath(targetSchemaUrl),"utf8"));
const severityOrder={error:0,warning:1,note:2};
function issue(code,severity,message,extra={}){return{code,severity,stage_owner:"layout",message,...extra};}
function sortIssues(issues){return issues.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||a.code.localeCompare(b.code)||(a.object_id??"").localeCompare(b.object_id??"")||(a.path??"").localeCompare(b.path??"")||a.message.localeCompare(b.message));}
function deepFreeze(value,seen=new Set()){if(value===null||typeof value!=="object"||seen.has(value))return value;seen.add(value);for(const child of Object.values(value))deepFreeze(child,seen);return Object.freeze(value);}

function readVisualPromotion(promotion){
  if(!promotion?.promoted||!promotion.validated_visual||!promotion.primitive_plan||!promotion.promotion_receipt)return null;
  const receipt=promotion.promotion_receipt,{promotion_hash,...base}=receipt;
  if(sha256Canonical(base)!==promotion_hash)return null;
  if(sha256Canonical(promotion.validated_visual)!==receipt.visual_hash)return null;
  const {plan_hash,...planBase}=promotion.primitive_plan;
  if(sha256Canonical(planBase)!==plan_hash||plan_hash!==receipt.primitive_plan_hash)return null;
  if(promotion.primitive_plan.figure_hash!==receipt.figure_hash||promotion.primitive_plan.registry_hash!==receipt.registry_hash)return null;
  return{visual:promotion.validated_visual,plan:promotion.primitive_plan,figureHash:receipt.figure_hash,visualHash:receipt.visual_hash,registryHash:receipt.registry_hash,planHash:receipt.primitive_plan_hash};
}
function validateTarget(target){return sortIssues(validateStructure(target,TARGET_SCHEMA).map(entry=>issue(entry.path.startsWith("$.target")?"LAY008_TARGET_MISSING":"LAY001_UNSAT","error",`layout target ${entry.path}: ${entry.message}`,{path:entry.path})));}
function internalRequest(target,plan){return{schema_version:"figthread.layout-request/0.1",target:structuredClone(target.target),measurements:structuredClone(plan.measurements),options:structuredClone(target.options)};}
function rebindLayout(result,visual){
  const intentBase=structuredClone(result.layout_intent);
  intentBase.visual_hash=visual.visualHash;intentBase.primitive_registry_hash=visual.registryHash;intentBase.primitive_plan_hash=visual.planHash;
  const intent=deepFreeze(intentBase),intentHash=sha256Canonical(intent);
  const {layout_hash:_old,...resolvedBase}=structuredClone(result.resolved_layout);
  resolvedBase.layout_intent_hash=intentHash;resolvedBase.visual_hash=visual.visualHash;resolvedBase.primitive_registry_hash=visual.registryHash;resolvedBase.primitive_plan_hash=visual.planHash;
  const resolved=deepFreeze({...resolvedBase,layout_hash:sha256Canonical(resolvedBase)});
  return{intent,intentHash,resolved};
}

export function compileVisualLayout(figurePromotion,visualPromotion,target,options={}){
  const mode=options.mode??"gate";if(!["draft","gate"].includes(mode))throw new TypeError("layout mode must be 'draft' or 'gate'");
  const visual=readVisualPromotion(visualPromotion);
  if(!visual)return{mode,status:"fail",promotion_eligible:false,layout_engine_version:LAYOUT_ENGINE_VERSION,issues:[issue("LAY001_UNSAT","error","layout compilation requires a valid promoted primitive plan",{stage_owner:"visual"})]};
  const targetIssues=validateTarget(target);if(targetIssues.length)return{figure_hash:visual.figureHash,visual_hash:visual.visualHash,primitive_plan_hash:visual.planHash,request_hash:sha256Canonical(target),mode,status:"fail",promotion_eligible:false,layout_engine_version:LAYOUT_ENGINE_VERSION,issues:targetIssues};
  const bridge=internalRequest(target,visual.plan),legacy=compilePromotedLayout(figurePromotion,bridge,{mode});
  if(legacy.status==="fail")return{...legacy,request_hash:sha256Canonical(target),visual_hash:visual.visualHash,primitive_registry_hash:visual.registryHash,primitive_plan_hash:visual.planHash};
  if(legacy.figure_hash!==visual.figureHash||legacy.layout_intent.intrinsic_metrics_hash!==visual.plan.intrinsic_metrics_hash)return{figure_hash:visual.figureHash,visual_hash:visual.visualHash,primitive_plan_hash:visual.planHash,request_hash:sha256Canonical(target),mode,status:"fail",promotion_eligible:false,layout_engine_version:LAYOUT_ENGINE_VERSION,issues:[issue("LAY001_UNSAT","error","layout engine metrics do not match the promoted primitive plan",{stage_owner:"visual"})]};
  const rebound=rebindLayout(legacy,visual),issues=sortIssues(structuredClone(legacy.issues));
  return{figure_hash:visual.figureHash,visual_hash:visual.visualHash,primitive_registry_hash:visual.registryHash,primitive_plan_hash:visual.planHash,request_hash:sha256Canonical(target),layout_intent_hash:rebound.intentHash,layout_hash:rebound.resolved.layout_hash,mode,status:legacy.status,promotion_eligible:mode==="gate"&&!issues.some(entry=>entry.severity==="error"),layout_engine_version:LAYOUT_ENGINE_VERSION,issues,layout_intent:rebound.intent,resolved_layout:rebound.resolved};
}
export function promoteVisualLayout(figurePromotion,visualPromotion,target){
  const result=compileVisualLayout(figurePromotion,visualPromotion,target,{mode:"gate"});if(!result.promotion_eligible)return{promoted:false,report:result};
  const receiptBase={kind:"resolved_layout",schema_version:result.resolved_layout.schema_version,figure_hash:result.figure_hash,visual_hash:result.visual_hash,primitive_registry_hash:result.primitive_registry_hash,primitive_plan_hash:result.primitive_plan_hash,layout_intent_hash:result.layout_intent_hash,layout_hash:result.layout_hash,target_id:result.resolved_layout.target.id,engine_version:LAYOUT_ENGINE_VERSION};
  return{promoted:true,report:result,resolved_layout:result.resolved_layout,layout_intent:result.layout_intent,promotion_receipt:deepFreeze({...receiptBase,promotion_hash:sha256Canonical(receiptBase)})};
}
