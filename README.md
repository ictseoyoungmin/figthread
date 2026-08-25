# Figthread

Figthread is a semantic figure authoring system. The implementation now covers three promoted slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate

Rendering, visual primitives, profile measurement, grammar registry closure, and export remain downstream slices.

## Source of truth

The installable skill is self-contained under `skills/figthread/` and is the implementation source of truth:

- `skills/figthread/schemas/figure-spec.schema.json` — semantic figure contract
- `skills/figthread/schemas/layout-*.schema.json` — layout request/intent/resolved contracts
- `skills/figthread/schemas/motion-spec.schema.json` — semantic motion contract
- `skills/figthread/runtime/validator.js` — D-001 promotion
- `skills/figthread/runtime/layout.js` — D-002 deterministic layout compiler/router/promotion
- `skills/figthread/runtime/motion.js` — D-003 motion validator/compiler/evaluator/promotion
- `skills/figthread/scripts/*.mjs` — skill-local CLIs
- `skills/figthread/references/` — agent-facing normative behavior without internal roadmap labels

Root `src/`, `schemas/`, `examples/`, and `test/` are repository development mirrors/harnesses and do not maintain a second runtime implementation.

## Promotion pipeline

```text
FigureSpec
  -> D-001 gate -> validated_figure
  -> LayoutRequest -> D-002 gate -> ResolvedLayout
  -> MotionSpec -> D-003 gate -> MotionProgram
```

D-002 never consumes an unpromoted FigureSpec. D-003 never consumes raw or mismatched semantic/layout state. MotionSpec contains semantic time/effects/cues only; geometry appears only in MotionProgram after resolution from promoted layout.

## Commands

```bash
npm test
npm run validate -- skills/figthread/examples/minimal.figure.json
npm run validate:promote -- skills/figthread/examples/minimal.figure.json
npm run layout -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.layout-request.json
npm run layout:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.layout-request.json
npm run motion -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.layout-request.json skills/figthread/examples/minimal.motion.json
npm run motion:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.layout-request.json skills/figthread/examples/minimal.motion.json
```

## D-003 guarantees

- consumes only matching verified semantic + layout promotion receipts
- deterministic integer-millisecond event ordering and program hashes
- event-sourced seek independent of prior DOM/frame state
- state effects validated against declared semantic domains
- concurrent writers rejected
- canonical motion contains no resolved geometry
- transfer/trace geometry derived only from promoted connector routes
- repeat loops require explicit semantic closure
- static/reduced-motion state comes from the figure summary snapshot
- arbitrary extension JavaScript/callbacks/network/randomness are not executable canonical motion
- immutable promoted MotionProgram snapshots and receipts

The explicit intrinsic measurement bridge remains temporary: later VisualSpec/primitive/profile slices will own how measurements are produced while preserving the semantic, geometry, and motion authority boundaries.
