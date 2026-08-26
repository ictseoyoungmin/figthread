# Figthread

Figthread is a semantic figure authoring system. The implementation now covers ten promoted development slices:

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

Browser-resolved glyph extent proof, topology-specific radial solving, multi-target packaging, and a bundled browser PNG capture adapter remain outside the current runtime.

## Source of truth

The installable skill under `skills/figthread/` is the runtime source of truth. Important execution additions are:

- `skills/figthread/runtime/execution.js` — run initialization, verification, promotion receipts, checkpoints, reopen, resume, and writer-lock recovery
- `skills/figthread/scripts/workspace.mjs` — skill-local workspace CLI
- `skills/figthread/references/execution-workspace.md` — agent-facing execution protocol
- `skills/figthread/schemas/run-manifest.schema.json` — mutable run-state contract
- `skills/figthread/schemas/stage-receipt.schema.json` — immutable stage-promotion record
- `skills/figthread/schemas/checkpoint.schema.json` — resumable active-state snapshot

The existing semantic, grammar, primitive, profile, layout, render, motion, document, and export runtimes remain under the same installed skill tree. Root `src/`, `schemas/`, `grammars/`, `profiles/`, `examples/`, and `test/` are development mirrors/harnesses, not a second implementation.

## Promotion and execution model

```text
source bytes
  -> run workspace
  -> understanding receipt
  -> claims receipt
  -> FigureSpec / semantic promotion
  -> grammar + visual promotion
  -> profile + layout promotion
  -> render + optional motion promotion
  -> self-contained document promotion
  -> exact artifact review
  -> export promotion
  -> completed run
```

The execution layer does not replace the figure promotion chain. It records which exact artifacts and evidence proved each stage and which revisions remain active.

```text
run manifest
  -> active frontier + revisions

StageReceipt
  -> source hash
  -> predecessor receipt hash
  -> artifact byte hashes
  -> evidence byte hashes
  -> optional authority hashes

checkpoint
  -> active receipt set
  -> revision counters
  -> frontier
  -> previous checkpoint hash
```

A file path, screenshot, or conversation claim is not completion proof. Completion requires a valid active receipt for every stage.

## Run directory

```text
run-<date>-<source8>/
├── run.json
├── intake/
├── stages/
│   ├── 01-understanding/
│   ├── 02-claims/
│   ├── 03-figure-ir/
│   ├── 04-grammar-visual/
│   ├── 05-layout/
│   ├── 06-motion/
│   ├── 07-document/
│   ├── 08-review/
│   └── 09-export/
├── receipts/
├── checkpoints/
├── evidence/
├── logs/
├── final/
└── tmp/
```

Each active stage receives a revision directory such as `stages/03-figure-ir/r0001/`. Reopen creates `r0002`, `r0003`, and so on rather than changing prior promoted history.

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

The skill-facing instructions use `node <skill-root>/scripts/workspace.mjs ...`; repository npm commands above are only developer conveniences.

## D-010 guarantees

- run source is copied into `intake/` and bound by exact byte hash and byte length
- run manifest is content-hashed and updated atomically
- nine fixed execution stages define one active frontier
- every promoted stage requires at least one exact artifact and one exact evidence file
- artifact/evidence paths cannot escape the run directory
- normal stage artifacts must live under the active revision directory; final export artifacts may also be bound under `final/`
- StageReceipt records are immutable and content-addressed
- receipt chains bind each stage to source provenance and the immediate promoted predecessor
- optional promoted authority hashes can be embedded in receipts
- every promotion creates a content-hashed checkpoint
- checkpoints form a previous-hash chain and snapshot active receipts, revisions, and frontier
- verification re-hashes source, receipts, artifacts, evidence, and the latest checkpoint
- resume finds the earliest invalid stage and returns a fresh-worker packet without conversation history
- reopen increments the causal stage revision and automatically invalidates all active descendants
- invalidated receipts/files remain preserved for audit
- changed promoted artifact/evidence bytes can be recovered by reopening the earliest invalid stage
- changed intake provenance or an invalid run manifest cannot be hidden by reopen
- mutating commands use one exclusive writer lock
- stale-lock recovery is explicit and leaves a content-hashed audit record
- full completion requires valid active receipts through export
- installed skill prose remains free of internal roadmap codes and public contract-version labels

## Figure pipeline commands

```bash
npm test
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

The next development bottleneck after execution closure is benchmark dogfooding: drive the full run protocol from source understanding through export with fresh-worker resume/reopen and use real evidence to expose remaining cross-stage defects.
