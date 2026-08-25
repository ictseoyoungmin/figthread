# Figthread

Figthread is a semantic figure authoring system. The implementation now covers four promoted slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate

Rendering, profile-owned text measurement, grammar registry closure, export, and full document/runtime packaging remain downstream slices.

## Source of truth

The installable skill is self-contained under `skills/figthread/` and is the implementation source of truth:

- `skills/figthread/schemas/figure-spec.schema.json` — semantic figure contract
- `skills/figthread/schemas/visual-spec.schema.json` — visual binding contract
- `skills/figthread/schemas/primitive-definition.schema.json` — custom primitive contract
- `skills/figthread/primitives/registry.json` — 24-family core primitive registry
- `skills/figthread/schemas/layout-target.schema.json` — public layout target contract
- `skills/figthread/schemas/layout-request.schema.json` — internal measurement bridge used by the base solver
- `skills/figthread/schemas/motion-spec.schema.json` — semantic motion contract
- `skills/figthread/runtime/validator.js` — D-001 promotion
- `skills/figthread/runtime/visual.js` — D-004 registry/binding/custom-primitive validation and PrimitivePlan promotion
- `skills/figthread/runtime/layout.js` — D-002 base deterministic solver/router
- `skills/figthread/runtime/visual-layout.js` — visual-aware layout adapter that derives metrics only from promoted PrimitivePlan
- `skills/figthread/runtime/motion.js` — D-003 motion validator/compiler/evaluator/promotion
- `skills/figthread/scripts/*.mjs` — skill-local CLIs
- `skills/figthread/references/` — agent-facing normative behavior without internal roadmap labels or contract-version labels

Root `src/`, `schemas/`, `examples/`, and `test/` are repository development mirrors/harnesses and do not maintain a second runtime implementation.

## Promotion pipeline

```text
FigureSpec
  -> D-001 gate -> validated_figure
  -> VisualSpec + primitive registry -> D-004 gate -> PrimitivePlan
  -> layout target -> D-002 gate -> ResolvedLayout
  -> MotionSpec -> D-003 gate -> MotionProgram
```

The agent-facing layout path no longer accepts hand-authored intrinsic node measurements. `PrimitivePlan.measurements` is the only source used by the public layout CLI. The lower-level `layout.js` measurement bridge remains internal so the deterministic solver can be migrated without duplicating its implementation.

Visual identity is carried into `LayoutIntent` and `ResolvedLayout` through the visual, registry, and primitive-plan hashes. Two visual bindings with identical dimensions therefore still produce distinct layout identities.

## Commands

```bash
npm test
npm run validate -- skills/figthread/examples/minimal.figure.json
npm run validate:promote -- skills/figthread/examples/minimal.figure.json
npm run visual -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json
npm run visual:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json
npm run layout -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run layout:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run motion -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
npm run motion:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
```

## D-004 guarantees

- exactly one primitive binding per semantic node
- core registry content hash verification
- deterministic registry + VisualSpec + PrimitivePlan hashes
- 24 compact core primitive families across structural, semantic, and mechanism classes
- registered variant validation
- semantic state binding only to declared primitive state channels
- S3 thesis-bearing/novel salience requires a custom primitive
- custom primitive IDs cannot shadow core definitions
- custom primitive minimum/preferred intrinsic dimensions are validated
- custom SVG rejects scripts, event handlers, `foreignObject`, and remote references
- PrimitivePlan is immutable and owns downstream intrinsic measurements
- public layout target contains no node measurements
- promoted layout identity includes visual/registry/primitive-plan identity
- existing motion promotion continues to consume only the resulting promoted geometry

The next measurement slice may add profile/font-aware text metrics, but it must strengthen or preserve primitive minimum floors rather than reintroduce browser/CSS geometry authority.
