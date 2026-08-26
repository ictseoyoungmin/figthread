# Figthread

Figthread is a semantic figure authoring system. The implementation now covers eight promoted slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate
- **D-005** — profile threshold registry + ProfilePlan gate
- **D-006** — deterministic static SVG renderer + rendered-profile evidence gate
- **D-007** — canonical figure grammar registry + GrammarPlan gate
- **D-008** — self-contained FigthreadDocument + fail-closed browser runtime gate

Browser-resolved glyph extent proof, topology-specific radial solving, multi-target packaging, PNG/export derivatives, and run-directory execution packaging remain downstream slices.

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
```

The document stage does not reinterpret the figure. It embeds canonical input, promoted compiled authority, the certified static SVG, and the optional MotionProgram into a deterministic single-target HTML runtime. Canonical payload hash, compile key, manifest build hash, and exact HTML hash remain distinct.

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
```

Omit the motion input from `document`/`document:promote` to produce a static self-contained document. Use `--runtime-mode interactive|clean|static` to choose initial view state without changing semantic authority.

## D-008 guarantees

- one deterministic self-contained HTML document for one promoted target
- separate canonical-input hash, compiled-authority compile key, document build hash, and exact HTML hash
- matching semantic, grammar, visual, profile, layout, render, and optional motion authority checks before composition
- embedded static SVG comes from the promoted renderer and is never hand-patched by the document compiler
- embedded MotionProgram remains geometry-bound to the promoted layout
- fail-closed browser bootstrap verifies manifest schema, build hash, canonical hash, compile key, target identity, SVG viewport, and external-dependency boundary before reporting ready
- runtime modes: interactive, clean, static, and fail-closed error
- event-sourced seeking from MotionProgram initial semantic state
- runtime projection for reveal, focus, trace, transfer, and morph-state cues without creating canonical geometry
- stable browser inspection surface: `getStatus`, `listTargets`, `activateTarget`, `renderAt`, `setMode`, `prepareExport`, `getStateHash`, and `getDiagnostics`
- static/reduced-motion/export preparation uses the semantic summary state rather than an arbitrary motion frame
- no external scripts, stylesheets, iframes, embedded objects, or network I/O in the runtime

The next bottleneck is export closure: turn the canonical HTML and certified static SVG into explicitly requested deterministic derivatives without allowing export tooling to become a second layout or rendering authority.
