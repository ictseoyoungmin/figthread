# Figthread

Figthread is a semantic figure authoring system. The implementation now covers two promoted slices:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate

Motion compilation, rendering, visual primitives, profile measurement, grammar registry closure, and export remain downstream slices.

## Source of truth

The installable skill is self-contained under `skills/figthread/` and is the implementation source of truth:

- `skills/figthread/schemas/figure-spec.schema.json` — FigureSpec 0.1
- `skills/figthread/schemas/layout-*.schema.json` — D-002 request/intent/resolved contracts
- `skills/figthread/runtime/validator.js` — D-001 promotion
- `skills/figthread/runtime/layout.js` — D-002 deterministic layout compiler/router/promotion
- `skills/figthread/scripts/validate.mjs` — FigureSpec CLI
- `skills/figthread/scripts/layout.mjs` — layout CLI
- `skills/figthread/references/figure-ir.md` and `layout-resolution.md` — normative contracts

Root `src/`, `schemas/`, `examples/`, and `test/` are repository development mirrors/harnesses and do not maintain a second runtime implementation.

## Promotion pipeline

```text
FigureSpec -> D-001 gate -> validated_figure -> LayoutRequest -> LayoutIntent -> deterministic solve/router/audit -> ResolvedLayout
```

D-002 never consumes an unpromoted FigureSpec. LayoutIntent contains semantic geometry intent but no resolved x/y/path data. ResolvedLayout is the first authoritative geometry object.

## Commands

```bash
npm test
npm run validate -- skills/figthread/examples/minimal.figure.json
npm run validate:promote -- skills/figthread/examples/minimal.figure.json
npm run layout -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.layout-request.json
npm run layout:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.layout-request.json
```

## D-002 guarantees

- consumes only a verified D-001 promotion receipt
- deterministic LayoutIntent/ResolvedLayout hashes
- explicit target viewport + safe area and normalized intrinsic metrics identity
- recursive containment layout with stable reading order
- hard minimum floors; soft gap/preferred-size shrink before hard failure
- orthogonal routing with semantic obstacle/crossing scoring
- overflow, collision, and crossing-budget diagnostics
- left-right/top-down base solver only; unsupported radial axes fail closed instead of using force layout
- immutable promoted layout snapshots and receipts

The explicit intrinsic measurement bridge is temporary: later VisualSpec/primitive/profile slices will own how those measurements are produced while preserving the D-002 authority boundary.
