import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promoteFigureSpec } from "../skills/figthread/runtime/validator.js";
import { PRIMITIVE_REGISTRY_HASH, promoteVisualSpec, validateVisualSpec } from "../skills/figthread/runtime/visual.js";
import { compileVisualLayout, promoteVisualLayout } from "../skills/figthread/runtime/visual-layout.js";

const figure=JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.figure.json",import.meta.url),"utf8"));
const visual=JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.visual.json",import.meta.url),"utf8"));
const target=JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.layout-target.json",import.meta.url),"utf8"));
const registry=JSON.parse(await readFile(new URL("../skills/figthread/primitives/registry.json",import.meta.url),"utf8"));
const figurePromotion=()=>{const result=promoteFigureSpec(figure);assert.equal(result.promoted,true);return result;};
const has=(report,code,objectId)=>report.issues.some(entry=>entry.code===code&&(objectId===undefined||entry.object_id===objectId));
const customDefinition=(overrides={})=>({id:"custom.focus-node@0.1",class:"mechanism",renderer:"svg",variants:["main"],view_box:[0,0,120,80],intrinsic:{min_w:100,min_h:60,pref_w:120,pref_h:80,aspect_policy:"free"},ports:["north","east","south","west"],slots:["body","label"],state_channels:["active"],tokens:["ink","accent"],local_svg:"<g><rect x=\"1\" y=\"1\" width=\"118\" height=\"78\"/></g>",...overrides});

test("bundled primitive registry identity is stable and matches the visual example",()=>{assert.equal(PRIMITIVE_REGISTRY_HASH,visual.registry_hash);assert.match(PRIMITIVE_REGISTRY_HASH,/^sha256:[0-9a-f]{64}$/);});

test("core primitive registry stays compact at eight families per class",()=>{assert.equal(registry.definitions.length,24);const count=(name)=>registry.definitions.filter(entry=>entry.class===name).length;assert.equal(count("structural"),8);assert.equal(count("semantic"),8);assert.equal(count("mechanism"),8);assert.equal(new Set(registry.definitions.map(entry=>entry.id)).size,24);});

test("visual promotion resolves every semantic node and owns intrinsic measurements",()=>{const promoted=promoteVisualSpec(figurePromotion(),visual);assert.equal(promoted.promoted,true);assert.equal(promoted.primitive_plan.bindings.length,figure.nodes.length);assert.deepEqual(promoted.primitive_plan.measurements,[{node_id:"node:input",min_w:100,min_h:60,pref_w:120,pref_h:80},{node_id:"node:output",min_w:100,min_h:60,pref_w:120,pref_h:80},{node_id:"node:queue",min_w:100,min_h:60,pref_w:140,pref_h:80}]);assert.equal(Object.isFrozen(promoted.primitive_plan),true);assert.equal(Object.isFrozen(promoted.validated_visual),true);assert.equal(Object.isFrozen(promoted.promotion_receipt),true);});

test("visual binding coverage is exact",()=>{const missing=structuredClone(visual);missing.bindings.pop();assert.ok(has(validateVisualSpec(figurePromotion(),missing),"PRM010_COVERAGE","node:output"));const duplicate=structuredClone(visual);duplicate.bindings.push(structuredClone(duplicate.bindings[1]));assert.ok(has(validateVisualSpec(figurePromotion(),duplicate),"PRM010_COVERAGE","node:input"));});

test("registry hash, primitive id, and variant are validated",()=>{const stale=structuredClone(visual);stale.registry_hash="sha256:"+"0".repeat(64);assert.ok(has(validateVisualSpec(figurePromotion(),stale),"PRM002_REGISTRY"));const unknown=structuredClone(visual);unknown.bindings[1].primitive="core.missing@0.1";assert.ok(has(validateVisualSpec(figurePromotion(),unknown),"PRM002_REGISTRY","node:input"));const variant=structuredClone(visual);variant.bindings[1].variant="missing";assert.ok(has(validateVisualSpec(figurePromotion(),variant),"PRM003_VARIANT","node:input"));});

test("state channels must exist and target the bound semantic node",()=>{const badChannel=structuredClone(visual);badChannel.bindings[2].state_bindings.unknown="state:queue-count";assert.ok(has(validateVisualSpec(figurePromotion(),badChannel),"PRM006_STATE","node:queue"));const wrongTarget=structuredClone(visual);wrongTarget.bindings[1].state_bindings.active="state:queue-count";assert.ok(has(validateVisualSpec(figurePromotion(),wrongTarget),"PRM006_STATE","node:input"));});

test("thesis-bearing salience requires a custom primitive",()=>{const generic=structuredClone(visual);generic.bindings[1].salience="S3";assert.ok(has(validateVisualSpec(figurePromotion(),generic),"PRM007_SALIENCE","node:input"));const custom=structuredClone(visual);custom.custom_definitions.push(customDefinition());custom.bindings[1]={...custom.bindings[1],primitive:"custom.focus-node@0.1",variant:"main",salience:"S3",state_bindings:{}};const result=validateVisualSpec(figurePromotion(),custom);assert.equal(result.status,"pass");});

test("custom primitives reject unsafe SVG and invalid intrinsic floors",()=>{const unsafe=structuredClone(visual);unsafe.custom_definitions.push(customDefinition({local_svg:"<g onclick=\"x()\"><script>x()</script></g>"}));assert.ok(has(validateVisualSpec(figurePromotion(),unsafe),"PRM008_PURITY"));const invalid=structuredClone(visual);invalid.custom_definitions.push(customDefinition({intrinsic:{min_w:120,min_h:80,pref_w:100,pref_h:70,aspect_policy:"free"}}));assert.ok(has(validateVisualSpec(figurePromotion(),invalid),"PRM004_INTRINSIC"));});

test("layout derives metrics from the promoted primitive plan",()=>{const fig=figurePromotion(),vis=promoteVisualSpec(fig,visual),result=compileVisualLayout(fig,vis,target);assert.equal(result.status,"pass");assert.equal(result.layout_intent.intrinsic_metrics_hash,vis.primitive_plan.intrinsic_metrics_hash);assert.equal(result.layout_intent.visual_hash,vis.promotion_receipt.visual_hash);assert.equal(result.resolved_layout.primitive_plan_hash,vis.primitive_plan.plan_hash);assert.equal(result.resolved_layout.boxes["node:input"].x,178);assert.equal(result.resolved_layout.boxes["node:queue"].x,330);assert.equal(result.resolved_layout.boxes["node:output"].x,502);});

test("visual identity changes layout identity even when intrinsic metrics are unchanged",()=>{const fig=figurePromotion(),aVisual=promoteVisualSpec(fig,visual),changed=structuredClone(visual);changed.bindings[1].variant="payload";const bVisual=promoteVisualSpec(fig,changed);assert.equal(aVisual.primitive_plan.intrinsic_metrics_hash,bVisual.primitive_plan.intrinsic_metrics_hash);const a=compileVisualLayout(fig,aVisual,target),b=compileVisualLayout(fig,bVisual,target);assert.notEqual(a.visual_hash,b.visual_hash);assert.notEqual(a.layout_hash,b.layout_hash);});

test("tampered primitive promotion is rejected before layout",()=>{const fig=figurePromotion(),promoted=promoteVisualSpec(fig,visual),tampered=structuredClone(promoted);tampered.promotion_receipt.primitive_plan_hash="sha256:"+"0".repeat(64);const result=compileVisualLayout(fig,tampered,target);assert.equal(result.status,"fail");assert.ok(has(result,"LAY001_UNSAT"));});

test("visual-aware layout promotion is stable and immutable",()=>{const fig=figurePromotion(),vis=promoteVisualSpec(fig,visual),a=promoteVisualLayout(fig,vis,target),b=promoteVisualLayout(fig,vis,target);assert.equal(a.promoted,true);assert.equal(a.promotion_receipt.promotion_hash,b.promotion_receipt.promotion_hash);assert.equal(a.resolved_layout.layout_hash,b.resolved_layout.layout_hash);assert.equal(Object.isFrozen(a.resolved_layout),true);assert.equal(Object.isFrozen(a.promotion_receipt),true);});
