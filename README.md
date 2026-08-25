# Figthread

Figthread is a semantic figure authoring system. The implementation now covers five promoted slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate
- **D-005** — profile threshold registry + ProfilePlan gate

Rendering, exact glyph/stroke/contrast proof, grammar registry closure, export, and full document/runtime packaging remain downstream slices.

## Source of truth

The installable skill is self-contained under `skills/figthread/` and is the implementation source of truth:

- `skills/figthread/schemas/figure-spec.schema.json` — semantic figure contract
- `skills/figthread/schemas/visual-spec.schema.json` — visual binding contract
- `skills/figthread/schemas/primitive-definition.schema.json` — custom primitive contract
- `skills/figthread/primitives/registry.json` — 24-family core primitive registry
- `skills/figthread/profiles/registry.json` — five-profile threshold registry
- `skills/figthread/schemas/profile-plan.schema.json` — promoted profile-plan contract
- `skills/figthread/schemas/layout-target.schema.json` — public layout target contract
- `skills/figthread/schemas/layout-request.schema.json` — internal measurement bridge used by the base solver
- `skills/figthread/schemas/motion-spec.schema.json` — semantic motion contract
- `skills/figthread/runtime/validator.js` — D-001 promotion
- `skills/figthread/runtime/visual.js` — D-004 registry/binding/custom-primitive validation and PrimitivePlan promotion
- `skills/figthread/runtime/profile.js` — D-005 threshold selection, density gate, deterministic measurement refinement, and motion-envelope validation
- `skills/figthread/runtime/layout.js` — D-002 base deterministic solver/router
- `skills/figthread/runtime/visual-layout.js` — profile-aware layout adapter
- `skills/figthread/runtime/profile-motion.js` — profile-envelope motion adapter
- `skills/figthread/runtime/motion.js` — D-003 semantic motion validator/compiler/evaluator/promotion
- `skills/figthread/scripts/*.mjs` — skill-local CLIs
- `skills/figthread/references/` — agent-facing normative behavior without internal roadmap labels or contract-version labels

Root `src/`, `schemas/`, `profiles/`, `examples/`, and `test/` are repository development mirrors/harnesses and do not maintain a second runtime implementation.

## Promotion pipeline

```text
FigureSpec
  -> D-001 gate -> validated_figure
  -> VisualSpec + primitive registry -> D-004 gate -> PrimitivePlan
  -> target + profile registry -> D-005 gate -> ProfilePlan
  -> D-002 gate -> ResolvedLayout
  -> MotionSpec + profile envelope -> D-003 gate -> MotionProgram
```

The agent-facing layout path does not accept hand-authored intrinsic node measurements. Primitive measurements are produced by `PrimitivePlan`, then `ProfilePlan` may only strengthen them with deterministic readability floors. The lower-level `layout.js` measurement request remains an internal solver bridge.

Profile identity is carried into `LayoutIntent` and `ResolvedLayout` through the profile-registry, threshold, and profile-plan hashes. Motion promotion additionally requires the selected profile envelope to pass before semantic motion compilation.

## Commands

```bash
npm test
npm run validate -- skills/figthread/examples/minimal.figure.json
npm run validate:promote -- skills/figthread/examples/minimal.figure.json
npm run visual -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json
npm run visual:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json
npm run profile -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run profile:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run layout -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run layout:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run motion -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
npm run motion:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
```

## D-005 guarantees

- content-hashed registry for `paper`, `paper-animated`, `presentation`, `technical-explainer`, and `infographic`
- profile-specific type, stroke, spacing, density, contrast/grayscale, and motion threshold metadata
- deterministic semantic-density accounting with S3 nodes consuming two slots
- hard density ceilings and deterministic soft-budget warning/fail rules
- deterministic label-derived measurement strengthening without weakening primitive minimums
- profile spacing floors that strengthen underspecified target gaps rather than silently accepting them
- presentation safe-margin enforcement
- immutable ProfilePlan snapshots and promotion receipts
- profile registry, threshold, and plan identity bound into LayoutIntent and ResolvedLayout hashes
- profile motion-envelope checks for cue duration, semantic-beat dwell, repeat-loop policy/duration, and simultaneous moving groups
- paper motion disabled and presentation repeat autoplay disabled by default
- exact renderer-only glyph/stroke/contrast/grayscale evidence is explicitly not fabricated by the current runtime

The next rendering slice can consume the promoted profile plan to prove actual glyph metrics, stroke thickness, contrast, grayscale behavior, and export placement size without reopening profile authority.
