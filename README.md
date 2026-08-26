# Figthread

Figthread is a semantic figure authoring system. The implementation now covers seven promoted slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate
- **D-005** — profile threshold registry + ProfilePlan gate
- **D-006** — deterministic static SVG renderer + rendered-profile evidence gate
- **D-007** — canonical figure grammar registry + GrammarPlan gate

Browser-resolved glyph extent proof, animated HTML runtime composition, export packaging, and full document/runtime packaging remain downstream slices.

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
- `skills/figthread/runtime/validator.js` — D-001 promotion
- `skills/figthread/runtime/grammar.js` — D-007 grammar validation, topology checks, and GrammarPlan promotion
- `skills/figthread/runtime/visual.js` — D-004 primitive binding/promotion
- `skills/figthread/runtime/profile.js` — D-005 profile threshold selection/promotion
- `skills/figthread/runtime/layout.js` — D-002 base deterministic solver/router
- `skills/figthread/runtime/visual-layout.js` — grammar/profile-aware layout adapter
- `skills/figthread/runtime/renderer.js` — D-006 deterministic static SVG renderer and rendered-profile audit
- `skills/figthread/runtime/profile-motion.js` — profile-envelope motion adapter
- `skills/figthread/runtime/motion.js` — D-003 semantic motion validator/compiler/evaluator/promotion
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
  -> MotionSpec + profile envelope -> D-003 gate -> MotionProgram
```

`figure_type` is no longer descriptive metadata. It must resolve through the content-hashed grammar registry, satisfy registered role/cardinality/topology/order/split rules, and produce a promoted GrammarPlan. Layout identity now includes the grammar registry, selected definition, and grammar-plan hashes.

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
npm run motion -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
npm run motion:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
```

## D-007 guarantees

- exactly twelve canonical root grammars: comparison, architecture, pipeline, mechanism, state-transition, timeline, network, hierarchy, swimlane, lifecycle, dataflow, and multi-panel
- content-hashed grammar registry and selected-definition identity
- required role/cardinality validation with ordered node bindings
- registered variant and reading-axis validation
- grammar-specific relation vocabulary and hybrid detection
- deterministic cycle/connectivity checks where the grammar requires them
- pipeline branch/merge limits and direct linear-stage flow
- state-transition semantic-state enforcement
- hierarchy single-parent/root/connectivity checks
- swimlane lane ownership checks
- lifecycle explicit semantic closure
- dataflow role disjointness/provenance participation
- multi-panel direct-child and cross-panel relation rules
- grammar split caps that fail instead of shrinking layout
- immutable GrammarPlan and promotion receipt
- grammar registry/definition/plan identity bound into LayoutIntent, ResolvedLayout, and layout promotion receipts
- all agent-facing layout/render/motion CLIs route through grammar promotion

The next closure slice should compose promoted static rendering and MotionProgram into a self-contained interactive HTML runtime without allowing DOM/CSS state to become semantic or geometry authority.
