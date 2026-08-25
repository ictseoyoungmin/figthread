# Figthread

Figthread is a semantic figure authoring system. The implementation now covers six promoted slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate
- **D-005** — profile threshold registry + ProfilePlan gate
- **D-006** — deterministic static SVG renderer + rendered-profile evidence gate

Grammar registry closure, browser-resolved glyph extent proof, animated HTML runtime composition, export packaging, and full document/runtime packaging remain downstream slices.

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
- `skills/figthread/runtime/visual.js` — D-004 primitive binding/promotion
- `skills/figthread/runtime/profile.js` — D-005 profile threshold selection/promotion
- `skills/figthread/runtime/layout.js` — D-002 base deterministic solver/router
- `skills/figthread/runtime/visual-layout.js` — profile-aware layout adapter
- `skills/figthread/runtime/renderer.js` — D-006 deterministic static SVG renderer and rendered-profile audit
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
  -> D-006 gate -> rendered_svg + rendered-profile evidence
  -> MotionSpec + profile envelope -> D-003 gate -> MotionProgram
```

The renderer does not own semantic meaning or global geometry. It scales local primitive view boxes into promoted boxes, serializes promoted connector routes, resolves static state from the semantic summary snapshot, and audits the SVG it actually emitted.

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
npm run render:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json --out figure.svg --evidence evidence.json
npm run motion -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
npm run motion:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
```

## D-006 guarantees

- deterministic standalone static SVG generated only from matching promoted semantic, visual, profile, and layout authorities
- content-hashed SVG, render artifact, rendered-profile evidence, and immutable promotion receipt
- deterministic SVG implementation for all 24 bundled core primitive families
- static state resolved from the declared semantic summary snapshot
- connector paths reused exactly from promoted `ResolvedLayout`
- explicit emitted primary-label font-size audit against profile floor
- explicit emitted essential-stroke audit against profile floor
- text/background and essential-mark/background contrast proof
- grayscale-only proof for `paper`
- script, `foreignObject`, and external-reference rejection
- color is not the sole emphasis/state discriminator
- custom primitives fail closed when their emitted content cannot provide auditable essential marks
- browser-resolved glyph extents/font fallback are explicitly recorded as not yet certified rather than fabricated

The next closure slice should make `figure_type` compile through a versioned grammar registry instead of remaining mostly descriptive metadata.
