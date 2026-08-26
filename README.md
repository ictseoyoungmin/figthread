# Figthread

Figthread is a semantic figure authoring system. The implementation now covers nine promoted slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate
- **D-005** — profile threshold registry + ProfilePlan gate
- **D-006** — deterministic static SVG renderer + rendered-profile evidence gate
- **D-007** — canonical figure grammar registry + GrammarPlan gate
- **D-008** — self-contained FigthreadDocument + fail-closed browser runtime gate
- **D-009** — content-addressed HTML/SVG export + browser-evidenced PNG capture gate

Browser-resolved glyph extent proof, topology-specific radial solving, multi-target packaging, and run-directory execution packaging remain downstream slices.

## Source of truth

The installable skill is self-contained under `skills/figthread/` and is the implementation source of truth:

- `skills/figthread/schemas/figure-spec.schema.json` — semantic figure contract
- `skills/figthread/grammars/registry.json` — content-hashed twelve-grammar registry
- `skills/figthread/schemas/grammar-plan.schema.json` — promoted grammar-plan contract
- `skills/figthread/schemas/visual-spec.schema.json` — visual binding contract
- `skills/figthread/schemas/primitive-definition.schema.json` — custom primitive contract
- `skills/figthread/primitives/registry.json` — 24-family core primitive registry
- `skills/figthread/profiles/registry.json` — five-profile threshold registry
- `skills/figthread/schemas/profile-plan.schema.json` — promoted profile-plan contract
- `skills/figthread/schemas/layout-target.schema.json` — public layout target contract
- `skills/figthread/schemas/layout-request.schema.json` — internal measurement bridge used by the base solver
- `skills/figthread/schemas/motion-spec.schema.json` — semantic motion contract
- `skills/figthread/schemas/document-manifest.schema.json` — self-contained document manifest contract
- `skills/figthread/schemas/export-spec.schema.json` — derivative export request contract
- `skills/figthread/runtime/validator.js` — D-001 promotion
- `skills/figthread/runtime/grammar.js` — D-007 grammar validation, topology checks, and GrammarPlan promotion
- `skills/figthread/runtime/visual.js` — D-004 primitive binding/promotion
- `skills/figthread/runtime/profile.js` — D-005 profile threshold selection/promotion
- `skills/figthread/runtime/layout.js` — D-002 base deterministic solver/router
- `skills/figthread/runtime/visual-layout.js` — grammar/profile-aware layout adapter
- `skills/figthread/runtime/renderer.js` — D-006 deterministic static SVG renderer and rendered-profile audit
- `skills/figthread/runtime/profile-motion.js` — profile-envelope motion adapter
- `skills/figthread/runtime/motion.js` — D-003 semantic motion validator/compiler/evaluator/promotion
- `skills/figthread/runtime/document.js` — D-008 manifest/hash-chain compiler and embedded browser runtime
- `skills/figthread/runtime/export.js` — D-009 export planning, text/vector derivatives, PNG capture evidence, and artifact promotion
- `skills/figthread/scripts/*.mjs` — skill-local CLIs
- `skills/figthread/references/` — agent-facing normative behavior without internal roadmap labels or contract-version labels

Root `src/`, `schemas/`, `grammars/`, `profiles/`, `examples/`, and `test/` are repository development mirrors/harnesses and do not maintain a second runtime implementation.

## Promotion pipeline

```text
FigureSpec
  -> D-001 gate -> validated_figure
  -> grammar registry -> D-007 gate -> GrammarPlan
  -> VisualSpec + primitive registry -> D-004 gate -> PrimitivePlan
  -> target + profile registry -> D-005 gate -> ProfilePlan
  -> D-002 gate -> ResolvedLayout
  -> D-006 gate -> rendered_svg + rendered-profile evidence
  -> optional MotionSpec + profile envelope -> D-003 gate -> MotionProgram
  -> D-008 gate -> self-contained FigthreadDocument HTML
  -> ExportSpec -> D-009 gate -> ExportArtifact
```

The export stage is derivative-only. It binds ExportSpec to the promoted document/render hashes and may package exact HTML, derive a vector-safe static-summary SVG, or accept a browser-captured PNG with deterministic state and environment evidence. It cannot change semantic or geometry authority.

## Commands

```bash
npm test
npm run validate -- skills/figthread/examples/minimal.figure.json
npm run validate:promote -- skills/figthread/examples/minimal.figure.json
npm run grammar -- skills/figthread/examples/minimal.figure.json
npm run grammar:promote -- skills/figthread/examples/minimal.figure.json
npm run visual -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json
npm run visual:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json
npm run profile -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run profile:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run layout -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run layout:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run render:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json --out figure.svg --evidence evidence.json
npm run motion:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
npm run document:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json --out figure.html
npm run export:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json skills/figthread/examples/minimal.export.json --out figure.svg
```

Omit the motion input from `document`/`document:promote` and `export`/`export:promote` when the figure has no motion. PNG promotion is adapter-driven: without a browser capture adapter, the runtime returns the deterministic capture plan and fails promotion rather than inventing a second raster renderer.

## D-009 guarantees

- ExportSpec is structurally and semantically validated against the exact promoted document target/profile
- ExportPlan binds request hash, canonical hash, compile key, document build/HTML hash, rendered SVG/render hash, motion-program hash, target, frame, scale, background, and live-text policy
- HTML export is the exact promoted self-contained document bytes
- default SVG export is byte-identical to the promoted rendered SVG
- SVG scale/background changes affect only derivative presentation; viewBox and promoted layout authority remain unchanged
- vector export fails on scripts, foreign objects, raster images, external references, or other non-vector-safe constructs
- PNG is never generated by a second Figthread raster renderer
- PNG capture plan fixes selector, semantic frame, expected state hash, expected local time, pixel dimensions, background, and scale
- PNG promotion verifies signature/chunk structure, chunk CRCs, exact dimensions, preparation evidence, source hashes, semantic state hash, and browser/font/environment fingerprint
- HTML/SVG determinism scope is exact bytes for identical promoted input/request
- PNG records a content hash and same-input/same-environment visual determinism scope without claiming cross-platform binary identity
- immutable ExportPlan, ExportArtifact, and export promotion receipt
- agent-facing prose remains free of internal roadmap codes and public contract-version labels

The next bottleneck is workspace/execution closure: make promotion receipts, reopen boundaries, resume checkpoints, and exact artifact evidence durable in a run directory so a fresh worker can resume without conversation history.
