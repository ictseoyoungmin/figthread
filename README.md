# Figthread

Figthread is a semantic figure authoring system whose canonical delivery surfaces are exact self-contained HTML documents and, when needed, one self-contained multi-target package made from independently promoted child documents.

The implementation retains the ten promoted architecture slices closed through 1.0.x:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate
- **D-005** — profile threshold registry + ProfilePlan gate
- **D-006** — deterministic static SVG renderer + rendered-profile evidence gate
- **D-007** — canonical figure grammar registry + GrammarPlan gate
- **D-008** — self-contained FigthreadDocument + fail-closed browser runtime gate
- **D-009** — content-addressed HTML/SVG export + browser-evidenced PNG capture contract
- **D-010** — resumable run directory + immutable StageReceipt/checkpoint/reopen gate

Version **1.0.1** added full fresh-worker benchmark dogfooding and repaired reopen revision reuse. Version **1.1.0** added actual Chrome-resolved glyph bounds and platform-font evidence. Version **1.2.0** adds multi-target document packaging without turning CSS scaling or runtime resize into canonical geometry.

Topology-specific radial solving and a bundled PNG capture adapter remain outside the current runtime.

## Source of truth

The installable skill under `skills/figthread/` is the runtime source of truth. Root `src/`, `schemas/`, `grammars/`, `profiles/`, `examples/`, `benchmarks/`, and `test/` are repository development mirrors and harnesses.

Important multi-target files are:

- `skills/figthread/runtime/document-package.js` — package authority, content hashing, embedded-child validation, and package runtime generation
- `skills/figthread/scripts/package.mjs` — independently promotes every target before packaging
- `skills/figthread/references/document-package.md` — agent-facing target/package authority protocol
- `skills/figthread/schemas/document-package.schema.json` — package manifest contract
- `skills/figthread/examples/minimal.package.json` — two-target package request

## Single-target promotion model

```text
source / claims
  -> FigureSpec
  -> GrammarPlan + PrimitivePlan
  -> ProfilePlan
  -> ResolvedLayout
  -> promoted static SVG
  -> optional MotionProgram
  -> self-contained FigthreadDocument
  -> browser-resolved text evidence
  -> review
  -> export
```

The browser text stage measures the exact promoted SVG with Chrome/Chromium and certifies glyph bounds, computed typography, font readiness, actual platform-font attribution, visibility, owner/viewport containment, and cross-owner label overlap. It is evidence only; it cannot repair copy or geometry.

## Multi-target packaging

One target is never resized to impersonate another. Every target is promoted independently:

```text
same semantic figure content
  ├─ target A profile -> layout A -> render A -> motion A -> document A
  ├─ target B profile -> layout B -> render B -> motion B -> document B
  └─ target C profile -> layout C -> render C -> motion C -> document C
                                      ↓
                              DocumentPackage
```

The package runtime validates that every child is a real promoted document and that all child targets share the same semantic figure content apart from profile selection. Target-specific profile/layout/render/motion/document hashes remain independent.

The package manifest binds:

- semantic-content hash;
- deterministic target order and default target;
- each target's profile and exact promoted viewport;
- child canonical hash, compile key, build hash, HTML hash, and document promotion hash;
- exact base64-encoded child HTML bytes;
- package runtime policy;
- one content hash over the complete package manifest.

The browser surface exposes `window.FigthreadPackage` with `getStatus`, `listTargets`, `activateTarget`, `getActiveTarget`, and `getDiagnostics`.

A child target is loaded at its exact promoted width and height into a scrollable frame. The parent package does **not** use `transform: scale(...)`. If a host viewport is smaller than a child target, the host scrolls it rather than silently changing certified geometry.

Run the bundled example:

```bash
npm run package:promote -- \
  skills/figthread/examples/minimal.figure.json \
  skills/figthread/examples/minimal.visual.json \
  skills/figthread/examples/minimal.package.json \
  skills/figthread/examples/minimal.motion.json \
  --out figure.package.html
```

The package request can supply different target profiles. The CLI clones the base semantic figure only to select each target profile, then reruns semantic → grammar → visual → profile → layout → render → optional motion → document independently. A target may set `motion: null` when that profile intentionally has no explanatory motion.

Package failures use `PKG001`–`PKG007`: invalid child authority, semantic drift, invalid target policy, duplicate target IDs, hash failure, external dependency, or runtime activation failure.

## Browser-resolved text evidence

The serialized SVG renderer keeps its own `browser_text_extent_certified` metric false because markup alone cannot prove browser shaping. The browser evidence layer closes that proof gap with a zero-dependency Chrome/Chromium DevTools-pipe adapter.

```bash
npm run text:evidence:promote -- \
  skills/figthread/examples/minimal.figure.json \
  skills/figthread/examples/minimal.visual.json \
  skills/figthread/examples/minimal.layout-target.json \
  skills/figthread/examples/minimal.motion.json \
  --out browser-text-evidence.json \
  --observation-out browser-text-observation.json
```

The evidence is environment-specific. Figthread does not claim that every OS resolves the same platform font or screenshot bytes.

## Full benchmark dogfood

`benchmarks/e2e-dogfood/` drives the actual runtime through source understanding, claims, semantic promotion, grammar/visual, profile/layout/render, process handoff, motion, document, exact review, causal reopen, descendant regeneration, export, and completion verification.

The benchmark intentionally lets an early wording defect pass core structural gates so exact artifact review must reopen `figure-ir` rather than patch the downstream SVG/HTML. Worker A and Worker B are separate Node processes; Worker B reconstructs authority from run-directory state rather than chat or process memory.

```bash
npm run benchmark:dogfood
```

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
npm run text:evidence:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json --out browser-text-evidence.json
npm run package:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.package.json skills/figthread/examples/minimal.motion.json --out figure.package.html
npm run export:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json skills/figthread/examples/minimal.export.json --out figure.svg
```

## Determinism boundary

Semantic, grammar, visual, profile, layout, static SVG, motion, single-target document, multi-target package, HTML export, and vector-safe SVG export identities are content-addressed under their declared inputs. Browser text evidence additionally binds its browser/platform environment.

A multi-target package is deterministic because it embeds exact promoted child HTML bytes and hashes. Browser target switching is projection state only.

## Next bottleneck

After multi-target packaging, the strongest remaining core-authoring limitation is **topology-specific radial layout solving**. The grammar registry already permits radial network intent, but the base layout solver deliberately fails closed instead of inventing unstable geometry. The next closure should add a deterministic radial solver with registered hub/ring order, explicit crossing policy, collision proof, and the same promotion/hash discipline as left-right and top-down layout.
