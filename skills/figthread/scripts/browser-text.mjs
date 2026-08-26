#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promoteFigureSpec } from "../runtime/validator.js";
import { promoteGrammarPlan } from "../runtime/grammar.js";
import { promoteVisualSpec } from "../runtime/visual.js";
import { promoteProfilePlan } from "../runtime/profile.js";
import { promoteProfileLayout } from "../runtime/visual-layout.js";
import { promoteRenderedSvg } from "../runtime/renderer.js";
import { promoteProfileMotionProgram } from "../runtime/profile-motion.js";
import { promoteFigthreadDocument } from "../runtime/document.js";
import { captureBrowserTextObservation, compileBrowserTextEvidence, promoteBrowserTextEvidence } from "../runtime/browser-text.js";

function usage() {
  console.error("usage: browser-text.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] [--mode draft|gate] [--promote] [--browser executable] [--out evidence.json] [--observation-out observation.json]");
}
const args = process.argv.slice(2), promote = args.includes("--promote"), modeIndex = args.indexOf("--mode"), browserIndex = args.indexOf("--browser"), outIndex = args.indexOf("--out"), observationIndex = args.indexOf("--observation-out"), mode = modeIndex >= 0 ? args[modeIndex + 1] : "gate";
const valueIndexes = new Set([modeIndex + 1, browserIndex + 1, outIndex + 1, observationIndex + 1].filter((i) => i > 0));
const flags = new Set(["--promote", "--mode", "--browser", "--out", "--observation-out"]);
const positional = args.filter((arg, index) => !flags.has(arg) && !valueIndexes.has(index));
if (![3, 4].includes(positional.length) || !["draft", "gate"].includes(mode) || (browserIndex >= 0 && !args[browserIndex + 1]) || (outIndex >= 0 && !args[outIndex + 1]) || (observationIndex >= 0 && !args[observationIndex + 1])) {
  usage(); process.exitCode = 2;
} else {
  try {
    const docs = await Promise.all(positional.map((file) => readFile(resolve(file), "utf8").then(JSON.parse)));
    const [figure, visual, target, motion = null] = docs;
    const figurePromotion = promoteFigureSpec(figure);
    if (!figurePromotion.promoted) throw Object.assign(new Error("semantic promotion failed"), { stage: "semantic", result: figurePromotion });
    const grammarPromotion = promoteGrammarPlan(figurePromotion);
    if (!grammarPromotion.promoted) throw Object.assign(new Error("grammar promotion failed"), { stage: "grammar", result: grammarPromotion });
    const visualPromotion = promoteVisualSpec(figurePromotion, visual);
    if (!visualPromotion.promoted) throw Object.assign(new Error("visual promotion failed"), { stage: "visual", result: visualPromotion });
    const profilePromotion = promoteProfilePlan(figurePromotion, visualPromotion, target);
    if (!profilePromotion.promoted) throw Object.assign(new Error("profile promotion failed"), { stage: "profile", result: profilePromotion });
    const layoutPromotion = promoteProfileLayout(figurePromotion, grammarPromotion, visualPromotion, profilePromotion);
    if (!layoutPromotion.promoted) throw Object.assign(new Error("layout promotion failed"), { stage: "layout", result: layoutPromotion });
    const renderPromotion = promoteRenderedSvg(figurePromotion, visualPromotion, profilePromotion, layoutPromotion);
    if (!renderPromotion.promoted) throw Object.assign(new Error("render promotion failed"), { stage: "render", result: renderPromotion });
    const motionPromotion = motion ? promoteProfileMotionProgram(figurePromotion, profilePromotion, layoutPromotion, motion) : null;
    if (motion && !motionPromotion.promoted) throw Object.assign(new Error("motion promotion failed"), { stage: "motion", result: motionPromotion });
    const documentPromotion = promoteFigthreadDocument({ figurePromotion, grammarPromotion, visualPromotion, profilePromotion, layoutPromotion, renderPromotion, motionPromotion }, { figure, visual, target, motion }, { initialMode: "static" });
    if (!documentPromotion.promoted) throw Object.assign(new Error("document promotion failed"), { stage: "document", result: documentPromotion });
    const observation = await captureBrowserTextObservation(documentPromotion, renderPromotion, { browserExecutable: browserIndex >= 0 ? args[browserIndex + 1] : null });
    if (observationIndex >= 0) await writeFile(resolve(args[observationIndex + 1]), `${JSON.stringify(observation, null, 2)}\n`, "utf8");
    const result = promote ? promoteBrowserTextEvidence(documentPromotion, renderPromotion, observation) : compileBrowserTextEvidence(documentPromotion, renderPromotion, observation, { mode });
    const evidence = result.browser_text_evidence;
    if (evidence && outIndex >= 0) await writeFile(resolve(args[outIndex + 1]), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    const output = { ...result, browser_text_evidence: evidence ? (outIndex >= 0 ? `[written:${args[outIndex + 1]}]` : evidence) : undefined, observation: observationIndex >= 0 ? `[written:${args[observationIndex + 1]}]` : { observation_hash: observation.observation_hash, environment: observation.environment, text_count: observation.measurements.length } };
    console.log(JSON.stringify(output, null, 2));
    const ok = promote ? result.promoted : result.status !== "fail"; if (!ok) process.exitCode = 1;
  } catch (error) {
    if (error.result) console.error(JSON.stringify({ stage: error.stage ?? "browser-text", status: "fail", error: error.message, report: error.result.report ?? error.result }, null, 2));
    else console.error(JSON.stringify({ stage: error.stage ?? "browser-text", status: "fail", code: error.code ?? null, error: error.message }, null, 2));
    process.exitCode = 2;
  }
}
