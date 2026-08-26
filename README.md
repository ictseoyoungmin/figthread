# Figthread

Figthread is a semantic figure authoring system whose canonical delivery surface is a self-contained HTML document with deterministic static SVG and optional semantic motion.

The implementation covers ten promoted development slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate
- **D-005** — profile threshold registry + ProfilePlan gate
- **D-006** — deterministic static SVG renderer + rendered-profile evidence gate
- **D-007** — canonical figure grammar registry + GrammarPlan gate
- **D-008** — self-contained FigthreadDocument + fail-closed browser runtime gate
- **D-009** — content-addressed HTML/SVG export + browser-evidenced PNG capture gate
- **D-010** — resumable run directory + immutable StageReceipt/checkpoint/reopen gate

Version **1.0.1** adds the first full benchmark dogfood over those slices and fixes a history-preservation defect exposed by that run.

Browser-resolved glyph extent proof, topology-specific radial solving, multi-target packaging, and a bundled browser PNG capture adapter remain outside the current runtime.

## Source of truth

The installable skill under `skills/figthread/` is the runtime source of truth. Root `src/`, `schemas/`, `grammars/`, `profiles/`, `examples/`, `benchmarks/`, and `test/` are repository development mirrors and harnesses, not a second runtime implementation.

Important execution files are:

- `skills/figthread/runtime/execution.js` — run initialization, verification, promotion receipts, checkpoints, reopen, resume, and writer-lock recovery
- `skills/figthread/scripts/workspace.mjs` — skill-local workspace CLI
- `skills/figthread/references/execution-workspace.md` — agent-facing execution protocol
- `skills/figthread/schemas/run-manifest.schema.json` — mutable run-state contract
- `skills/figthread/schemas/stage-receipt.schema.json` — immutable stage-promotion record
- `skills/figthread/schemas/checkpoint.schema.json` — resumable active-state snapshot

## Promotion and execution model

```text
source bytes
  -> run workspace
  -> understanding receipt
  -> claims receipt
  -> FigureSpec / semantic promotion
  -> grammar + visual promotion
  -> profile + layout + exact static render
  -> optional semantic motion promotion
  -> self-contained document promotion
  -> exact artifact review
  -> export promotion
  -> completed run
```

The execution layer does not replace semantic, grammar, visual, profile, layout, render, motion, document, or export authority. It records which exact artifacts and evidence proved each stage and which causal revisions remain active.

```text
StageReceipt
  -> source hash
  -> predecessor receipt hash
  -> artifact byte hashes
  -> evidence byte hashes
  -> optional promoted authority hashes

checkpoint
  -> active receipt set
  -> revision counters
  -> frontier
  -> previous checkpoint hash
```

A file path, screenshot, or conversation claim is not completion proof. Completion requires a valid active receipt for every execution stage.

## Full benchmark dogfood

`benchmarks/e2e-dogfood/` drives the actual runtime through the complete long-running workflow rather than testing validators in isolation.

The benchmark source requires the terminal pipeline node to be named **Delivered Result**. The first semantic revision deliberately uses the weaker label **Output**. That revision passes core semantic/grammar/visual/layout/render gates, proving that a later exact-artifact review is still necessary for source fidelity.

The benchmark then performs this lifecycle:

```text
worker A
  source -> understanding -> claims -> figure-ir
  -> grammar/visual -> profile/layout/render
  -> checkpoint -> process exits

worker B
  resume from run directory at motion
  -> motion -> document -> exact artifact review
  -> review detects source wording loss
  -> reopen figure-ir
  -> regenerate every affected descendant
  -> review PASS -> SVG export -> complete run
```

The two workers are separate Node processes. Worker B reconstructs promoted authority from stage artifacts rather than process memory or conversation history.

The first dogfood exposed a real execution bug: reopening an upstream stage reset downstream revision counters, allowing a later pass to reuse `r0001` directories. That violated the immutable-history contract. The runtime now advances every already-started affected stage to a new revision, including the open downstream frontier, while never incrementing stages that have genuinely never started.

For the benchmark review-time reopen, the repaired causal branch is:

```text
figure-ir       r0002
grammar-visual  r0002
layout          r0002
motion          r0002
document        r0002
review          r0002
export          r0002
```

The regression harness asserts that prior `r0001` document bytes remain byte-identical after the repaired run finishes.

Run the benchmark:

```bash
npm run benchmark:dogfood
```

Detailed scenario and finding notes live in:

- `benchmarks/e2e-dogfood/README.md`
- `benchmarks/e2e-dogfood/FINDINGS.md`

## Workspace commands

```bash
npm run workspace -- stages
npm run workspace -- init ./runs ./source.pdf
npm run workspace -- resume ./runs/run-...
npm run workspace -- verify ./runs/run-...
npm run workspace -- promote ./runs/run-... understanding --artifact <path> --evidence <path>
npm run workspace -- reopen ./runs/run-... figure-ir --reason "review exposed upstream cause"
npm run workspace -- checkpoint ./runs/run-... --reason "handoff"
npm run workspace -- recover-lock ./runs/run-... --reason "confirmed crashed worker"
```

The installed skill uses `node <skill-root>/scripts/workspace.mjs ...`; repository npm commands are developer conveniences.

## Figure pipeline commands

```bash
npm test
npm run benchmark:dogfood
npm run validate:promote -- skills/figthread/examples/minimal.figure.json
npm run grammar:promote -- skills/figthread/examples/minimal.figure.json
npm run visual:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json
npm run profile:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run layout:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run render:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json --out figure.svg --evidence evidence.json
npm run motion:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
npm run document:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json --out figure.html
npm run export:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json skills/figthread/examples/minimal.export.json --out figure.svg
```

## Next bottleneck

With the first full execution dogfood in place, the next strongest quality bottleneck is **browser-resolved text evidence**: certify actual font selection and glyph/text extents from the rendered document so typography overflow cannot remain an explicitly unproved renderer assumption.
