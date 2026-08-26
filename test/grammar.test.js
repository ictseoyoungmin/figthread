import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promoteFigureSpec } from "../skills/figthread/runtime/validator.js";
import { GRAMMAR_REGISTRY_HASH, promoteGrammarPlan, validateGrammar } from "../skills/figthread/runtime/grammar.js";
import { promoteVisualSpec } from "../skills/figthread/runtime/visual.js";
import { promoteProfilePlan } from "../skills/figthread/runtime/profile.js";
import { promoteProfileLayout } from "../skills/figthread/runtime/visual-layout.js";

const visual = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.visual.json", import.meta.url), "utf8"));
const target = JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.layout-target.json", import.meta.url), "utf8"));
function node(id, kind="process", data={}) { return { id, kind, label:id.split(":").at(-1), parent_id:"node:root", claim_refs:["claim:primary"], data }; }
function rel(id, kind, from, to) { return { id, kind, from, to, claim_refs:["claim:primary"] }; }
function figure({type,variant,axis,nodes,relations=[],bindings}) { return { schema_version:"figthread.figure/0.1", id:`fig:${type.replaceAll("-",".")}`, profile:"technical-explainer", figure_type:type, thesis_claim_id:"claim:primary", claims:[{id:"claim:primary",role:"primary",statement:`${type} claim`,source_refs:["source:test"],must_preserve:true}], nodes:[{id:"node:root",kind:"panel",label:type,claim_refs:["claim:primary"]},...nodes], relations, states:[], composition:{grammar:{type,version:"0.1",variant,reading_axis:axis,role_bindings:bindings},root_id:"node:root",order:nodes.map(x=>x.id)}, emphasis:{primary:nodes.slice(0,1).map(x=>x.id),secondary:[],muted:[]}, snapshots:[{id:"snapshot:summary",kind:"summary",state_values:{}}], static_snapshot_id:"snapshot:summary", extensions:{} }; }
function promote(doc){ const p=promoteFigureSpec(doc); assert.equal(p.promoted,true,JSON.stringify(p.report)); return p; }
function ok(doc){ const p=promoteGrammarPlan(promote(doc)); assert.equal(p.promoted,true,JSON.stringify(p.report)); return p; }
function has(report,code){ return report.issues.some(x=>x.code===code); }

const cases=[
 ["comparison","paired","left-right",[node("node:a","object"),node("node:b","object")],[rel("relation:a-b","compares-with","node:a","node:b")],{subjects:["node:a","node:b"]}],
 ["architecture","layered","left-right",[node("node:a"),node("node:b","state")],[rel("relation:a-b","flows-to","node:a","node:b")],{components:["node:a","node:b"]}],
 ["pipeline","linear","left-right",[node("node:a","stage"),node("node:b","stage"),node("node:c","stage")],[rel("relation:a-b","flows-to","node:a","node:b"),rel("relation:b-c","flows-to","node:b","node:c")],{stages:["node:a","node:b","node:c"]}],
 ["mechanism","cause-effect","left-right",[node("node:a"),node("node:b","result")],[rel("relation:a-b","transforms-into","node:a","node:b")],{components:["node:a","node:b"]}],
 ["state-transition","linear","left-right",[node("node:a","state"),node("node:b","state")],[rel("relation:a-b","triggers","node:a","node:b")],{states:["node:a","node:b"]}],
 ["timeline","points","left-right",[node("node:a","stage"),node("node:b","stage")],[],{events:["node:a","node:b"]}],
 ["network","layered","left-right",[node("node:a"),node("node:b"),node("node:c")],[rel("relation:a-b","shares-with","node:a","node:b"),rel("relation:b-c","shares-with","node:b","node:c")],{nodes:["node:a","node:b","node:c"]}],
 ["hierarchy","top-down","top-down",[node("node:a","group"),node("node:b","object"),node("node:c","object")],[rel("relation:a-b","contains","node:a","node:b"),rel("relation:a-c","contains","node:a","node:c")],{root:["node:a"],members:["node:b","node:c"]}],
 ["swimlane","horizontal","left-right",[node("node:lane-a","actor"),node("node:lane-b","actor"),node("node:a","process",{lane_id:"node:lane-a"}),node("node:b","process",{lane_id:"node:lane-b"})],[rel("relation:a-b","flows-to","node:a","node:b")],{lanes:["node:lane-a","node:lane-b"],steps:["node:a","node:b"]}],
 ["lifecycle","cycle","left-right",[node("node:a","stage"),node("node:b","stage"),node("node:c","stage")],[rel("relation:a-b","flows-to","node:a","node:b"),rel("relation:b-c","flows-to","node:b","node:c"),rel("relation:c-a","flows-to","node:c","node:a")],{phases:["node:a","node:b","node:c"]}],
 ["dataflow","linear","left-right",[node("node:op","process"),node("node:data","object")],[rel("relation:op-data","transforms-into","node:op","node:data")],{operators:["node:op"],artifacts:["node:data"]}],
 ["multi-panel","sequence","left-right",[{id:"node:a",kind:"panel",label:"a",parent_id:"node:root",claim_refs:["claim:primary"]},{id:"node:b",kind:"panel",label:"b",parent_id:"node:root",claim_refs:["claim:primary"]}],[],{panels:["node:a","node:b"]}]
];

test("grammar registry contains exactly the twelve canonical root grammars", async()=>{ const r=JSON.parse(await readFile(new URL("../skills/figthread/grammars/registry.json", import.meta.url),"utf8")); assert.equal(r.registry_hash,GRAMMAR_REGISTRY_HASH); assert.deepEqual(r.definitions.map(x=>x.id),cases.map(x=>x[0])); });
for(const [type,variant,axis,nodes,relations,bindings] of cases) test(`${type} canonical grammar promotes`,()=>{ const p=ok(figure({type,variant,axis,nodes,relations,bindings})); assert.equal(p.grammar_plan.grammar_id,type); assert.equal(Object.isFrozen(p.grammar_plan),true); });
test("linear pipeline rejects a semantic cycle",()=>{ const [type,variant,axis,nodes,relations,bindings]=cases[2]; const doc=figure({type,variant,axis,nodes,relations:[...relations,rel("relation:c-a","flows-to","node:c","node:a")],bindings}); const r=validateGrammar(promote(doc)); assert.equal(r.status,"fail"); assert.ok(has(r,"GRM006_CYCLE")); });
test("lifecycle requires explicit semantic closure",()=>{ const [type,variant,axis,nodes,relations,bindings]=cases[9]; const doc=figure({type,variant,axis,nodes,relations:relations.slice(0,2),bindings}); const r=validateGrammar(promote(doc)); assert.equal(r.status,"fail"); assert.ok(has(r,"GRM006_CYCLE")); });
test("hybrid pipeline relations fail rather than becoming renderer geometry",()=>{ const [type,variant,axis,nodes,relations,bindings]=cases[2]; const doc=figure({type,variant,axis,nodes,relations:[...relations,rel("relation:a-c","contains","node:a","node:c")],bindings}); const r=validateGrammar(promote(doc)); assert.equal(r.status,"fail"); assert.ok(has(r,"GRM010_HYBRID")); });
test("grammar identity is bound into promoted layout identity",()=>{ const doc=figure({type:"pipeline",variant:"linear",axis:"left-right",nodes:[node("node:input","stage"),node("node:queue","state"),node("node:output","result")],relations:[rel("relation:input-queue","flows-to","node:input","node:queue"),rel("relation:queue-output","flows-to","node:queue","node:output")],bindings:{stages:["node:input","node:queue","node:output"]}}); doc.id="fig:minimal-pipeline"; doc.nodes[0].label="Processing pipeline"; const fp=promote(doc); const gp=promoteGrammarPlan(fp); const vp=promoteVisualSpec(fp,visual); assert.equal(vp.promoted,true); const pp=promoteProfilePlan(fp,vp,target); assert.equal(pp.promoted,true); const lp=promoteProfileLayout(fp,gp,vp,pp); assert.equal(lp.promoted,true,JSON.stringify(lp.report)); assert.equal(lp.layout_intent.grammar_plan_hash,gp.grammar_plan.plan_hash); assert.equal(lp.promotion_receipt.grammar_registry_hash,gp.promotion_receipt.registry_hash); });
