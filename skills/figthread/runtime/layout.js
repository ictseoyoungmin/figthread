import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { validateStructure } from "./schema-validator.js";

export const LAYOUT_ENGINE_VERSION = "0.2.0";
export const LAYOUT_REQUEST_SCHEMA_VERSION = "figthread.layout-request/0.1";
export const LAYOUT_INTENT_SCHEMA_VERSION = "figthread.layout/0.1";
export const RESOLVED_LAYOUT_SCHEMA_VERSION = "figthread.resolved-layout/0.1";

const DEFAULTS = Object.freeze({ preferred_gap: 32, min_gap: 12, container_padding: 16, routing_grid: 4, obstacle_margin: 8, max_crossings: 4 });
const requestSchemaUrl = new URL("../schemas/layout-request.schema.json", import.meta.url);
const LAYOUT_REQUEST_SCHEMA = JSON.parse(readFileSync(fileURLToPath(requestSchemaUrl), "utf8"));
const severityOrder = { error: 0, warning: 1, note: 2 };
const round = (value) => Math.round(value * 1000) / 1000;
const center = (start, extent, size) => start + (extent - size) / 2;
const point = (x, y) => ({ x: round(x), y: round(y) });

function issue(code, severity, message, extra = {}) { return { code, severity, stage_owner: "layout", message, ...extra }; }
function sortIssues(issues) { return issues.sort((a,b) => severityOrder[a.severity]-severityOrder[b.severity] || a.code.localeCompare(b.code) || (a.object_id??"").localeCompare(b.object_id??"") || (a.path??"").localeCompare(b.path??"") || a.message.localeCompare(b.message)); }
function deepFreeze(value, seen = new Set()) { if (value === null || typeof value !== "object" || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) deepFreeze(child, seen); return Object.freeze(value); }
function readPromotion(promotion) {
  if (!promotion?.promoted || !promotion.validated_figure || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt; const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  if (sha256Canonical(promotion.validated_figure) !== receipt.input_hash) return null;
  return { figure: promotion.validated_figure, figureHash: receipt.input_hash };
}

function validateRequest(figure, request) {
  const structural = validateStructure(request, LAYOUT_REQUEST_SCHEMA).map((entry) => issue(entry.path.startsWith("$.target") ? "LAY008_TARGET_MISSING" : "LAY001_UNSAT", "error", `layout request ${entry.path}: ${entry.message}`, { path: entry.path }));
  if (structural.length) return sortIssues(structural);
  const issues = []; const target = request.target;
  if (target.safe_area.left + target.safe_area.right >= target.viewport.width || target.safe_area.top + target.safe_area.bottom >= target.viewport.height) issues.push(issue("LAY001_UNSAT", "error", "safe area leaves no positive layout viewport", { path: "$.target.safe_area" }));
  if (target.profile !== figure.profile) issues.push(issue("LAY008_TARGET_MISSING", "error", `target profile ${target.profile} does not match promoted FigureSpec profile ${figure.profile}`, { path: "$.target.profile" }));
  const opts = { ...DEFAULTS, ...(request.options ?? {}) };
  if (opts.min_gap > opts.preferred_gap) issues.push(issue("LAY001_UNSAT", "error", "min_gap cannot exceed preferred_gap", { path: "$.options.min_gap" }));
  const metrics = new Map();
  for (const [index, metric] of request.measurements.entries()) {
    if (metrics.has(metric.node_id)) { issues.push(issue("LAY001_UNSAT", "error", `duplicate measurement for ${metric.node_id}`, { object_id: metric.node_id, path: "$.measurements" })); continue; }
    if (metric.pref_w < metric.min_w || metric.pref_h < metric.min_h) issues.push(issue("LAY001_UNSAT", "error", `preferred size cannot be smaller than minimum size for ${metric.node_id}`, { object_id: metric.node_id, path: `$.measurements[${index}]` }));
    metrics.set(metric.node_id, metric);
  }
  const rootId = figure.composition.root_id;
  for (const node of figure.nodes) if (node.id !== rootId && !metrics.has(node.id)) issues.push(issue("LAY001_UNSAT", "error", `missing intrinsic measurement for ${node.id}`, { object_id: node.id, path: "$.measurements" }));
  for (const nodeId of metrics.keys()) if (!figure.nodes.some(n => n.id === nodeId)) issues.push(issue("LAY001_UNSAT", "error", `measurement references unknown node ${nodeId}`, { object_id: nodeId, path: "$.measurements" }));
  return sortIssues(issues);
}

function axisFromReadingAxis(readingAxis) { if (["left-right","horizontal","x"].includes(readingAxis)) return "x"; if (["top-down","vertical","y"].includes(readingAxis)) return "y"; if (["radial","clockwise"].includes(readingAxis)) return "radial"; return null; }
function portPolicy(axis) {
  if (axis === "y") return { allowed_sides: ["north","south"], preferred_sides: ["south","north"] };
  if (axis === "radial") return { allowed_sides: ["north","east","south","west"], preferred_sides: ["north","east","south","west"] };
  return { allowed_sides: ["west","east"], preferred_sides: ["east","west"] };
}

function compileIntent(figure, figureHash, request) {
  const target = request.target; const options = { ...DEFAULTS, ...(request.options ?? {}) }; const primaryAxis = axisFromReadingAxis(figure.composition.grammar.reading_axis);
  const nodeById = new Map(figure.nodes.map(node => [node.id,node])); const root = figure.composition.root_id; const orderIndex = new Map(figure.composition.order.map((id,index)=>[id,index]));
  const sortNodes = nodes => [...nodes].sort((a,b) => (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER) || (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
  const childrenByParent = new Map(figure.nodes.map(node => [node.id, []])); for (const node of figure.nodes) if (node.parent_id && childrenByParent.has(node.parent_id)) childrenByParent.get(node.parent_id).push(node); for (const [parent, nodes] of childrenByParent) childrenByParent.set(parent, sortNodes(nodes));
  const parentIds = [root, ...figure.nodes.filter(node => node.id !== root && (childrenByParent.get(node.id)?.length ?? 0) > 0).map(node => node.id).sort()];
  const regions = parentIds.map((parentId,index) => ({ id: `region:${parentId.replace(/:/g,"-")}`, role: parentId === root ? "root" : "group", members: (childrenByParent.get(parentId) ?? []).map(node=>node.id), parent: parentId === root ? null : `region:${(nodeById.get(parentId)?.parent_id ?? root).replace(/:/g,"-")}`, order: index, equalize: false }));
  const constraints = [];
  for (const [index, region] of regions.entries()) {
    const prefix = region.id.replace(/:/g,"-");
    constraints.push({ id: `constraint:${prefix}-contain`, kind: index === 0 ? "inside-safe-area" : "inside-parent", subjects: region.members, strength: "hard", priority: index * 10 });
    constraints.push({ id: `constraint:${prefix}-order`, kind: "reading-order", subjects: region.members, strength: "hard", priority: index * 10 + 1 });
    constraints.push({ id: `constraint:${prefix}-non-overlap`, kind: "non-overlap", subjects: region.members, strength: "hard", priority: index * 10 + 2 });
    if (primaryAxis !== "radial") constraints.push({ id: `constraint:${prefix}-alignment`, kind: primaryAxis === "y" ? "align-center-x" : "align-center-y", subjects: region.members, strength: "strong", priority: 100 + index });
    constraints.push({ id: `constraint:${prefix}-compact`, kind: "compactness", subjects: region.members, strength: "soft", priority: 200 + index });
  }
  const normalizedMeasurements = [...request.measurements].map(metric => ({ node_id: metric.node_id, min_w: metric.min_w, min_h: metric.min_h, pref_w: metric.pref_w, pref_h: metric.pref_h })).sort((a,b)=>a.node_id.localeCompare(b.node_id));
  return deepFreeze({ schema_version: LAYOUT_INTENT_SCHEMA_VERSION, figure_hash: figureHash, intrinsic_metrics_hash: sha256Canonical(normalizedMeasurements), target: { id: target.id, profile: figure.profile, viewport: { width: target.viewport.width, height: target.viewport.height }, safe_area: { ...target.safe_area }, density_budget: target.density_budget ?? null }, grammar: { type: figure.composition.grammar.type, variant: figure.composition.grammar.variant, primary_axis: primaryAxis, reading_order: figure.composition.order.slice() }, regions, constraints, ports: Object.fromEntries(figure.nodes.map(node => [node.id, portPolicy(primaryAxis)])), text_policy: { max_lines_by_role: {}, wrap: "word", ellipsis: false }, routing: { style: "orthogonal", grid: options.routing_grid, bend_penalty: 100, crossing_penalty: 1000, obstacle_margin: options.obstacle_margin }, options: { preferred_gap: options.preferred_gap, min_gap: options.min_gap, container_padding: options.container_padding, max_crossings: options.max_crossings }, overrides: [] });
}

function buildModel(figure, request, intent) {
  const nodeById = new Map(figure.nodes.map(node=>[node.id,node])); const metricById = new Map(request.measurements.map(metric=>[metric.node_id,metric])); const children = new Map(figure.nodes.map(node=>[node.id,[]]));
  for (const node of figure.nodes) if (node.parent_id && children.has(node.parent_id)) children.get(node.parent_id).push(node.id);
  const orderIndex = new Map(figure.composition.order.map((id,index)=>[id,index]));
  const sortIds = ids => [...ids].sort((a,b) => (orderIndex.get(a)??Number.MAX_SAFE_INTEGER)-(orderIndex.get(b)??Number.MAX_SAFE_INTEGER) || (nodeById.get(a)?.order??Number.MAX_SAFE_INTEGER)-(nodeById.get(b)?.order??Number.MAX_SAFE_INTEGER) || a.localeCompare(b));
  for (const [parent, ids] of children) children.set(parent,sortIds(ids));
  return { nodeById, metricById, children, axis: intent.grammar.primary_axis, options: intent.options, rootId: figure.composition.root_id, orderIndex };
}
function footprint(model, nodeId, memo = new Map()) {
  if (memo.has(nodeId)) return memo.get(nodeId); const metric = model.metricById.get(nodeId); const childIds = model.children.get(nodeId) ?? []; if (!metric) throw new Error(`missing measurement: ${nodeId}`);
  let result = { min_w: metric.min_w, min_h: metric.min_h, pref_w: metric.pref_w, pref_h: metric.pref_h };
  if (childIds.length) {
    const child = childIds.map(id=>footprint(model,id,memo)); const p = model.options.container_padding, gapMin = model.options.min_gap, gapPref = model.options.preferred_gap; const localAxis = model.axis === "radial" ? "y" : model.axis;
    if (localAxis === "y") {
      result.min_w = Math.max(result.min_w, Math.max(...child.map(x=>x.min_w))+2*p); result.pref_w = Math.max(result.pref_w, Math.max(...child.map(x=>x.pref_w))+2*p);
      result.min_h = Math.max(result.min_h, child.reduce((n,x)=>n+x.min_h,0)+gapMin*(child.length-1)+2*p); result.pref_h = Math.max(result.pref_h, child.reduce((n,x)=>n+x.pref_h,0)+gapPref*(child.length-1)+2*p);
    } else {
      result.min_h = Math.max(result.min_h, Math.max(...child.map(x=>x.min_h))+2*p); result.pref_h = Math.max(result.pref_h, Math.max(...child.map(x=>x.pref_h))+2*p);
      result.min_w = Math.max(result.min_w, child.reduce((n,x)=>n+x.min_w,0)+gapMin*(child.length-1)+2*p); result.pref_w = Math.max(result.pref_w, child.reduce((n,x)=>n+x.pref_w,0)+gapPref*(child.length-1)+2*p);
    }
  }
  memo.set(nodeId,result); return result;
}
function fitMain(items, available, preferredGap, minGap) {
  const n=items.length; if (!n) return { sizes:[], gap:0, used:0 }; const minTotal=items.reduce((s,x)=>s+x.min,0)+minGap*Math.max(0,n-1); if (minTotal > available + 1e-9) return null;
  const prefSum=items.reduce((s,x)=>s+x.pref,0); let gap=preferredGap;
  if (prefSum + gap*Math.max(0,n-1) <= available) return { sizes:items.map(x=>x.pref), gap, used:prefSum+gap*Math.max(0,n-1) };
  if (n>1) gap=Math.max(minGap, Math.min(preferredGap,(available-prefSum)/(n-1)));
  if (prefSum + gap*Math.max(0,n-1) <= available + 1e-9) return { sizes:items.map(x=>x.pref), gap, used:prefSum+gap*Math.max(0,n-1) };
  gap=minGap; const room=available-gap*Math.max(0,n-1), overflow=prefSum-room, capacity=items.reduce((s,x)=>s+(x.pref-x.min),0), ratio=capacity===0?0:overflow/capacity; const sizes=items.map(x=>x.pref-(x.pref-x.min)*ratio);
  return { sizes, gap, used:sizes.reduce((s,x)=>s+x,0)+gap*Math.max(0,n-1) };
}
function anchors(box) { return { north: point(box.x+box.w/2,box.y), east: point(box.x+box.w,box.y+box.h/2), south: point(box.x+box.w/2,box.y+box.h), west: point(box.x,box.y+box.h/2) }; }
function materializeBox(box, hasChildren, padding) {
  const rounded={x:round(box.x),y:round(box.y),w:round(box.w),h:round(box.h)}, inset=hasChildren?padding:0;
  return {...rounded,content_box:{x:round(rounded.x+inset),y:round(rounded.y+inset),w:round(rounded.w-2*inset),h:round(rounded.h-2*inset)},anchors:anchors(rounded)};
}
function placeChildren(model,parentId,parentBox,boxes,memo,issues,axisOverride=null) {
  const ids=model.children.get(parentId)??[]; if (!ids.length) return; const p=parentId===model.rootId?0:model.options.container_padding; const content={x:parentBox.x+p,y:parentBox.y+p,w:parentBox.w-2*p,h:parentBox.h-2*p}; const fp=ids.map(id=>({id,...footprint(model,id,memo)})), axis=axisOverride ?? model.axis, isY=axis==="y", mainAvail=isY?content.h:content.w, crossAvail=isY?content.w:content.h;
  const main=fitMain(fp.map(x=>({min:isY?x.min_h:x.min_w,pref:isY?x.pref_h:x.pref_w})),mainAvail,model.options.preferred_gap,model.options.min_gap); if (!main) { issues.push(issue("LAY001_UNSAT","error",`minimum intrinsic sizes do not fit inside ${parentId}`,{object_id:parentId})); return; }
  for (const x of fp) { const crossMin=isY?x.min_w:x.min_h; if (crossMin>crossAvail+1e-9) { issues.push(issue("LAY001_UNSAT","error",`minimum cross-axis size for ${x.id} exceeds container ${parentId}`,{object_id:x.id})); return; } }
  let cursor=(isY?content.y:content.x)+(mainAvail-main.used)/2;
  ids.forEach((id,index)=>{ const x=fp[index], mainSize=main.sizes[index], crossPref=isY?x.pref_w:x.pref_h, crossSize=Math.min(crossPref,crossAvail); const box=isY ? {x:center(content.x,content.w,crossSize),y:cursor,w:crossSize,h:mainSize} : {x:cursor,y:center(content.y,content.h,crossSize),w:mainSize,h:crossSize}; const childCount=(model.children.get(id)??[]).length; boxes[id]=materializeBox(box,childCount>0,model.options.container_padding); cursor+=mainSize+main.gap; placeChildren(model,id,boxes[id],boxes,memo,issues,axisOverride); });
}

function radialTopology(figure) {
  const { type, variant } = figure.composition.grammar;
  if (type === "network" && variant === "radial") return "hub-spoke";
  if (type === "architecture" && variant === "hub-spoke") return "hub-spoke";
  if (type === "lifecycle" && ["cycle","ring"].includes(variant)) return "cycle";
  if (type === "mechanism" && variant === "feedback-loop") return "cycle";
  return null;
}
function roleIds(figure, name) { const ids=figure.composition.grammar.role_bindings?.[name]; return Array.isArray(ids) ? ids : []; }
function semanticDegree(figure, id, allowed) {
  let degree=0; for (const relation of figure.relations) { if (!allowed.has(relation.from) || !allowed.has(relation.to)) continue; if (relation.from===id || relation.to===id) degree+=1; } return degree;
}
function chooseHub(figure, model, directIds) {
  if (figure.figure_type === "network") {
    const explicit=roleIds(figure,"hub")[0] ?? null; return directIds.includes(explicit) ? explicit : null;
  }
  const components=roleIds(figure,"components").filter(id=>directIds.includes(id)); const candidates=components.length?components:directIds; const allowed=new Set(directIds);
  return [...candidates].sort((a,b)=>semanticDegree(figure,b,allowed)-semanticDegree(figure,a,allowed) || (model.orderIndex.get(a)??Number.MAX_SAFE_INTEGER)-(model.orderIndex.get(b)??Number.MAX_SAFE_INTEGER) || a.localeCompare(b))[0] ?? null;
}
function interpolateFootprint(fp, t) { return { w: fp.min_w + (fp.pref_w-fp.min_w)*t, h: fp.min_h + (fp.pref_h-fp.min_h)*t }; }
function diagonal(size) { return Math.hypot(size.w,size.h); }
function maxRadiusForPlacement(content, cx, cy, ring, sizes, offset) {
  const n=ring.length, delta=n?2*Math.PI/n:0; let max=Infinity;
  for (let i=0;i<n;i++) {
    const theta=-Math.PI/2+offset+i*delta, c=Math.cos(theta), s=Math.sin(theta), size=sizes.get(ring[i]);
    const horizontal=c>1e-12?(content.x+content.w-cx-size.w/2)/c:c<-1e-12?(cx-content.x-size.w/2)/(-c):Infinity;
    const vertical=s>1e-12?(content.y+content.h-cy-size.h/2)/s:s<-1e-12?(cy-content.y-size.h/2)/(-s):Infinity;
    max=Math.min(max,horizontal,vertical);
  }
  return Math.max(0,max);
}
function requiredRingRadius(ring, sizes, gap, hubSize=null) {
  const n=ring.length; let required=0;
  if (n>1) {
    const sine=Math.sin(Math.PI/n);
    for (let i=0;i<n;i++) {
      const a=sizes.get(ring[i]),b=sizes.get(ring[(i+1)%n]), chord=(diagonal(a)+diagonal(b))/2+gap; required=Math.max(required,chord/(2*sine));
    }
  }
  if (hubSize) for (const id of ring) required=Math.max(required,(diagonal(hubSize)+diagonal(sizes.get(id)))/2+gap);
  return required;
}
function exactRadialBoxes(content, ring, sizes, radius, offset, hubId=null, hubSize=null) {
  const cx=content.x+content.w/2,cy=content.y+content.h/2,n=ring.length,delta=n?2*Math.PI/n:0,out={};
  if (hubId && hubSize) out[hubId]={x:cx-hubSize.w/2,y:cy-hubSize.h/2,w:hubSize.w,h:hubSize.h};
  ring.forEach((id,index)=>{ const theta=-Math.PI/2+offset+index*delta,size=sizes.get(id),x=cx+radius*Math.cos(theta)-size.w/2,y=cy+radius*Math.sin(theta)-size.h/2; out[id]={x,y,w:size.w,h:size.h}; });
  return out;
}
function boxesOverlapRaw(a,b,gap=0) { return Math.max(a.x-gap/2,b.x-gap/2)<Math.min(a.x+a.w+gap/2,b.x+b.w+gap/2)-1e-9 && Math.max(a.y-gap/2,b.y-gap/2)<Math.min(a.y+a.h+gap/2,b.y+b.h+gap/2)-1e-9; }
function radialCandidate(content, ring, hubId, footprints, t, offset, options) {
  const sizes=new Map(ring.map(id=>[id,interpolateFootprint(footprints.get(id),t)])),hubSize=hubId?interpolateFootprint(footprints.get(hubId),t):null,cx=content.x+content.w/2,cy=content.y+content.h/2;
  if (hubSize && (hubSize.w>content.w+1e-9 || hubSize.h>content.h+1e-9)) return null;
  const maxRadius=maxRadiusForPlacement(content,cx,cy,ring,sizes,offset),minimum=requiredRingRadius(ring,sizes,options.min_gap,hubSize),preferred=requiredRingRadius(ring,sizes,options.preferred_gap,hubSize);
  if (minimum>maxRadius+1e-9) return null; const radius=Math.min(maxRadius,Math.max(minimum,preferred)); const raw=exactRadialBoxes(content,ring,sizes,radius,offset,hubId,hubSize),ids=Object.keys(raw);
  for (let i=0;i<ids.length;i++) for (let j=i+1;j<ids.length;j++) if (boxesOverlapRaw(raw[ids[i]],raw[ids[j]],options.min_gap)) return null;
  return { raw, radius };
}
function placeRadialChildren(figure,model,rootBox,boxes,memo,issues) {
  const topology=radialTopology(figure); if (!topology) { issues.push(issue("LAY009_RADIAL_TOPOLOGY","error",`radial solving is not defined for ${figure.figure_type}/${figure.composition.grammar.variant}`,{path:"composition.grammar"})); return; }
  const directIds=model.children.get(model.rootId)??[]; if (!directIds.length) return; let hubId=null;
  if (topology==="hub-spoke") { hubId=chooseHub(figure,model,directIds); if (!hubId) { issues.push(issue("LAY009_RADIAL_TOPOLOGY","error","hub-spoke radial solving requires a direct-child hub candidate",{path:"composition.grammar.role_bindings"})); return; } }
  const ring=directIds.filter(id=>id!==hubId); if (!ring.length) { issues.push(issue("LAY009_RADIAL_TOPOLOGY","error","radial solving requires at least one ring node",{object_id:model.rootId})); return; }
  const footprints=new Map(directIds.map(id=>[id,footprint(model,id,memo)])); const content={x:rootBox.x,y:rootBox.y,w:rootBox.w,h:rootBox.h}; const n=ring.length,delta=2*Math.PI/n,offsets=[0,delta/2,-delta/2,delta/4,-delta/4]; const scales=[1,0.875,0.75,0.625,0.5,0.375,0.25,0.125,0]; let chosen=null;
  for (const t of scales) { for (const offset of offsets) { chosen=radialCandidate(content,ring,hubId,footprints,t,offset,model.options); if (chosen) break; } if (chosen) break; }
  if (!chosen) { issues.push(issue("LAY001_UNSAT","error",`minimum intrinsic sizes cannot satisfy ${topology} radial geometry inside ${model.rootId}`,{object_id:model.rootId})); return; }
  for (const id of directIds) { const childCount=(model.children.get(id)??[]).length; boxes[id]=materializeBox(chosen.raw[id],childCount>0,model.options.container_padding); if (childCount) placeChildren(model,id,boxes[id],boxes,memo,issues,"y"); }
}

function segmentHitsBox(a,b,box,margin=0) { const left=box.x-margin,right=box.x+box.w+margin,top=box.y-margin,bottom=box.y+box.h+margin; if (a.x===b.x) return a.x>left && a.x<right && Math.max(Math.min(a.y,b.y),top) < Math.min(Math.max(a.y,b.y),bottom); if (a.y===b.y) return a.y>top && a.y<bottom && Math.max(Math.min(a.x,b.x),left) < Math.min(Math.max(a.x,b.x),right); return false; }
function simplify(points) { const out=[]; for (const p of points) { const q=point(p.x,p.y); if (out.length && out.at(-1).x===q.x && out.at(-1).y===q.y) continue; out.push(q); } let changed=true; while(changed){ changed=false; for(let i=1;i<out.length-1;i++){const a=out[i-1],b=out[i],c=out[i+1]; if((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y)){out.splice(i,1);changed=true;break;}} } return out; }
function segments(points){const out=[]; for(let i=1;i<points.length;i++) out.push([points[i-1],points[i]]); return out;}
function segmentCross(a,b,c,d) { const ah=a.y===b.y, ch=c.y===d.y; if (ah===ch) return false; const h1=ah?a:c,h2=ah?b:d,v1=ah?c:a,v2=ah?d:b; const minX=Math.min(h1.x,h2.x),maxX=Math.max(h1.x,h2.x),minY=Math.min(v1.y,v2.y),maxY=Math.max(v1.y,v2.y),x=v1.x,y=h1.y; return x>minX&&x<maxX&&y>minY&&y<maxY; }
function pathMetrics(points,obstacles,priorSegments,margin){ const segs=segments(points); let obstacleHits=0,crossings=0,length=0; for(const [a,b] of segs){ length+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y); for(const box of obstacles) if(segmentHitsBox(a,b,box,margin)) obstacleHits++; for(const [c,d] of priorSegments) if(segmentCross(a,b,c,d)) crossings++; } return {obstacleHits,crossings,bends:Math.max(0,points.length-2),length}; }
function dominantAxis(from,to) { const dx=(to.x+to.w/2)-(from.x+from.w/2),dy=(to.y+to.h/2)-(from.y+from.h/2); return Math.abs(dy)>Math.abs(dx)?"y":"x"; }
function chooseAnchors(from,to,axis){ const routeAxis=axis==="radial"?dominantAxis(from,to):axis; if(routeAxis==="y") return from.y+from.h/2<=to.y+to.h/2 ? ["south","north"] : ["north","south"]; return from.x+from.w/2<=to.x+to.w/2 ? ["east","west"] : ["west","east"]; }
function isAncestor(model,a,b){ let cur=model.nodeById.get(b); while(cur?.parent_id){ if(cur.parent_id===a)return true; cur=model.nodeById.get(cur.parent_id); } return false; }
function routeRelation(relation,boxes,axis,model,priorSegments){
  const from=boxes[relation.from],to=boxes[relation.to], routeAxis=axis==="radial"?dominantAxis(from,to):axis, [sourceSide,targetSide]=chooseAnchors(from,to,axis), s=from.anchors[sourceSide],t=to.anchors[targetSide], grid=Math.max(1,model.options.routing_grid),margin=model.options.obstacle_margin;
  const obstacleBoxes=Object.entries(boxes).filter(([id])=>id!==relation.from&&id!==relation.to&&id!==model.rootId&&!isAncestor(model,id,relation.from)&&!isAncestor(model,id,relation.to)).map(([,box])=>box), root=boxes[model.rootId], candidates=[];
  const midX=round((s.x+t.x)/2),midY=round((s.y+t.y)/2),left=root.x+margin+grid,right=root.x+root.w-margin-grid,top=root.y+margin+grid,bottom=root.y+root.h-margin-grid;
  if(routeAxis==="y") candidates.push(simplify([s,{x:s.x,y:midY},{x:t.x,y:midY},t])); else candidates.push(simplify([s,{x:midX,y:s.y},{x:midX,y:t.y},t]));
  if(axis==="radial") {
    candidates.push(simplify([s,{x:t.x,y:s.y},t])); candidates.push(simplify([s,{x:s.x,y:t.y},t]));
    candidates.push(simplify([s,{x:left,y:s.y},{x:left,y:t.y},t])); candidates.push(simplify([s,{x:right,y:s.y},{x:right,y:t.y},t])); candidates.push(simplify([s,{x:s.x,y:top},{x:t.x,y:top},t])); candidates.push(simplify([s,{x:s.x,y:bottom},{x:t.x,y:bottom},t]));
  } else if(routeAxis==="y") { candidates.push(simplify([s,{x:left,y:s.y},{x:left,y:t.y},t])); candidates.push(simplify([s,{x:right,y:s.y},{x:right,y:t.y},t])); }
  else { candidates.push(simplify([s,{x:s.x,y:top},{x:t.x,y:top},t])); candidates.push(simplify([s,{x:s.x,y:bottom},{x:t.x,y:bottom},t])); }
  const scored=candidates.map((points,index)=>{const m=pathMetrics(points,obstacleBoxes,priorSegments,margin); return {points,index,...m,score:m.obstacleHits*100000+m.crossings*10000+m.bends*100+m.length};}).sort((a,b)=>a.score-b.score||a.index-b.index)[0];
  return {source_anchor:`${relation.from}.${sourceSide}`,target_anchor:`${relation.to}.${targetSide}`,points:scored.points,path_d:scored.points.map((p,i)=>`${i?"L":"M"}${p.x} ${p.y}`).join(" "),bend_count:scored.bends,crossing_count:scored.crossings,obstacle_hits:scored.obstacleHits};
}
function boxOverlap(a,b){ return Math.max(a.x,b.x)<Math.min(a.x+a.w,b.x+b.w)-1e-9 && Math.max(a.y,b.y)<Math.min(a.y+a.h,b.y+b.h)-1e-9; }
function audit(model,boxes,connectors,intent){
  const issues=[],safe=intent.target.safe_area,vp=intent.target.viewport,root={x:safe.left,y:safe.top,w:vp.width-safe.left-safe.right,h:vp.height-safe.top-safe.bottom};
  for(const [id,box] of Object.entries(boxes)){ if(id===model.rootId)continue; if(box.x<root.x-1e-6||box.y<root.y-1e-6||box.x+box.w>root.x+root.w+1e-6||box.y+box.h>root.y+root.h+1e-6)issues.push(issue("LAY003_OVERFLOW","error",`${id} exceeds target safe area`,{object_id:id})); }
  const ids=Object.keys(boxes).filter(id=>id!==model.rootId); for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=ids[i],b=ids[j]; if(isAncestor(model,a,b)||isAncestor(model,b,a))continue; if(boxOverlap(boxes[a],boxes[b]))issues.push(issue("LAY004_COLLISION","error",`${a} overlaps ${b}`,{object_id:a,path:b}));}
  let crossings=0; for(const [id,c] of Object.entries(connectors)){ crossings+=c.crossing_count; if(c.obstacle_hits)issues.push(issue("LAY004_COLLISION","error",`${id} route intersects ${c.obstacle_hits} semantic obstacle(s)`,{object_id:id})); if(c.points.some(p=>p.x<root.x-1e-6||p.x>root.x+root.w+1e-6||p.y<root.y-1e-6||p.y>root.y+root.h+1e-6))issues.push(issue("LAY003_OVERFLOW","error",`${id} route exceeds target safe area`,{object_id:id})); }
  if(crossings>model.options.max_crossings)issues.push(issue("LAY005_ROUTE_DENSE","error",`connector crossings ${crossings} exceed budget ${model.options.max_crossings}`)); return sortIssues(issues);
}

export function compilePromotedLayout(promotion, request, options = {}) {
  const mode=options.mode??"gate"; if(!["draft","gate"].includes(mode)) throw new TypeError("layout mode must be 'draft' or 'gate'"); const promoted=readPromotion(promotion);
  if(!promoted){const issues=[issue("LAY001_UNSAT","error","layout accepts only a valid promoted FigureSpec",{stage_owner:"figure-ir"})]; return {mode,status:"fail",promotion_eligible:false,layout_engine_version:LAYOUT_ENGINE_VERSION,issues};}
  const {figure,figureHash}=promoted; const requestHash=(()=>{try{return sha256Canonical(request)}catch{return undefined}})(); const requestIssues=validateRequest(figure,request); if(requestIssues.length)return {figure_hash:figureHash,request_hash:requestHash,mode,status:"fail",promotion_eligible:false,layout_engine_version:LAYOUT_ENGINE_VERSION,issues:requestIssues};
  const intent=compileIntent(figure,figureHash,request),intentHash=sha256Canonical(intent); if(!intent.grammar.primary_axis){const issues=[issue("LAY001_UNSAT","error",`unsupported reading axis ${figure.composition.grammar.reading_axis}`,{path:"composition.grammar.reading_axis"})];return{figure_hash:figureHash,request_hash:requestHash,layout_intent:intent,layout_intent_hash:intentHash,mode,status:"fail",promotion_eligible:false,layout_engine_version:LAYOUT_ENGINE_VERSION,issues};}
  const model=buildModel(figure,request,intent),issues=[],boxes={},safe=intent.target.safe_area,vp=intent.target.viewport,rootBox={x:round(safe.left),y:round(safe.top),w:round(vp.width-safe.left-safe.right),h:round(vp.height-safe.top-safe.bottom)}; boxes[model.rootId]={...rootBox,content_box:{...rootBox},anchors:anchors(rootBox)}; const memo=new Map();
  if(model.axis==="radial") placeRadialChildren(figure,model,rootBox,boxes,memo,issues); else placeChildren(model,model.rootId,rootBox,boxes,memo,issues);
  if(issues.some(x=>x.severity==="error"))return{figure_hash:figureHash,request_hash:requestHash,layout_intent:intent,layout_intent_hash:intentHash,mode,status:"fail",promotion_eligible:false,layout_engine_version:LAYOUT_ENGINE_VERSION,issues:sortIssues(issues)};
  const connectors={},priorSegments=[]; for(const relation of figure.relations){const routed=routeRelation(relation,boxes,model.axis,model,priorSegments); connectors[relation.id]=routed; priorSegments.push(...segments(routed.points));}
  issues.push(...audit(model,boxes,connectors,intent)); const diagnostics=sortIssues(issues); const base={schema_version:RESOLVED_LAYOUT_SCHEMA_VERSION,figure_hash:figureHash,layout_intent_hash:intentHash,engine_version:LAYOUT_ENGINE_VERSION,target:{id:intent.target.id,viewport:intent.target.viewport,scale_policy:"fixed-target"},boxes,text:{},connectors,diagnostics},resolved={...base,layout_hash:sha256Canonical(base)},hasErrors=diagnostics.some(x=>x.severity==="error"),report={figure_hash:figureHash,request_hash:requestHash,layout_intent_hash:intentHash,layout_hash:resolved.layout_hash,mode,status:hasErrors?"fail":diagnostics.length?"pass-with-warnings":"pass",promotion_eligible:mode==="gate"&&!hasErrors,layout_engine_version:LAYOUT_ENGINE_VERSION,issues:diagnostics}; return { ...report, layout_intent:intent, resolved_layout:deepFreeze(resolved) };
}
export function promoteResolvedLayout(promotion, request) { const result=compilePromotedLayout(promotion,request,{mode:"gate"}); if(!result.promotion_eligible)return{promoted:false,report:result}; const receiptBase={kind:"resolved_layout",schema_version:RESOLVED_LAYOUT_SCHEMA_VERSION,figure_hash:result.figure_hash,layout_intent_hash:result.layout_intent_hash,layout_hash:result.layout_hash,target_id:result.resolved_layout.target.id,engine_version:LAYOUT_ENGINE_VERSION}; return {promoted:true,report:result,resolved_layout:result.resolved_layout,layout_intent:result.layout_intent,promotion_receipt:deepFreeze({...receiptBase,promotion_hash:sha256Canonical(receiptBase)})}; }
