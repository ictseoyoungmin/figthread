# Figthread

Figthread is a semantic figure authoring system whose canonical delivery surface is a self-contained HTML document with deterministic static SVG, browser-resolved typography evidence, and optional semantic motion.

The implementation retains the ten promoted architecture slices closed through 1.0.x:

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

Version **1.0.1** added the first full fresh-worker benchmark dogfood and repaired downstream revision reuse exposed by that run. Version **1.1.0** closes the next quality gap: actual browser-shaped glyph bounds and platform-font identity are now independently certified against the exact promoted SVG/document authority.

Topology-specific radial solving, multi-target document packaging, and a bundled PNG capture adapter remain outside the current runtime.

## Source of truth

The installable skill under `skills/figthread/` is the runtime source of truth. Root `src/`, `schemas/`, `grammars/`, `profiles/`, `examples/`, `benchmarks/`, and `test/` are repository development mirrors and harnesses, not a second runtime implementation.

Important browser text evidence files are:

- `skills/figthread/runtime/browser-text.js` — deterministic plan/evidence validation plus zero-dependency Chrome/Chromium DevTools adapter
- `skills/figthread/scripts/browser-text.mjs` — full-chain browser text evidence CLI
- `skills/figthread/references/browser-text-evidence.md` — agent-facing authority and recovery protocol
- `skills/figthread/schemas/browser-text-evidence.schema.json` — promoted evidence contract

Execution remains owned by `skills/figthread/runtime/execution.js` and `skills/figthread/scripts/workspace.mjs`.

## Promotion and execution model

```text
source bytes
  -> run workspace
  -> understanding receipt
  -> claims receipt
  -> FigureSpec / semantic promotion
  -> grammar + visual promotion
  -> profile + layout + exact static render
  -> optional semantic motion promotion
  -> self-contained document promotion
  -> browser-resolved text evidence
  -> exact artifact review
  -> export promotion
  -> completed run
```

Browser text evidence does not become a second layout engine. It binds the exact promoted document, SVG, render, layout, profile threshold, target, semantic labels, and owner boxes into a deterministic BrowserTextPlan. A real Chrome/Chromium process then returns an environment-bound observation. Only validation of that observation produces promoted BrowserTextEvidence.

The evidence layer can reject geometry or copy, but it cannot repair either one.

## Browser-resolved text evidence

The static renderer already certifies explicit SVG font size, stroke, contrast, grayscale, coverage, and purity. It intentionally keeps its own `browser_text_extent_certified` metric false because serialized markup cannot prove browser shaping.

The browser evidence stage closes that gap by measuring every primary label with the exact promoted SVG bytes in an isolated `about:blank` measurement harness. It records:

- semantic owner, role, and exact rendered text;
- computed font size, family stack, weight, visibility, and opacity;
- SVG `getBBox()` glyph bounds and browser-space bounds;
- `document.fonts` loading/availability state;
- actual platform font families and glyph counts from Chrome DevTools `CSS.getPlatformFontsForNode`;
- browser product/revision, DevTools protocol, JavaScript version, user agent, platform, language, and device-pixel ratio.

There is no Puppeteer or Playwright dependency and no localhost/file-navigation requirement. Chrome is launched with `--remote-debugging-pipe`; the measurement harness is installed directly in an isolated blank target and discarded afterward.

Promotion fails on authority/hash mismatch, source text drift, missing or duplicate labels, font-size floor violation, unresolved platform fonts, empty glyph bounds, owner-box overflow, viewport overflow, cross-owner label overlap, hidden text, incomplete environment identity, or tampered observation/evidence hashes. Diagnostics use `TXT001` through `TXT010`.

Run it directly:

```bash
npm run text:evidence:promote -- \
  skills/figthread/examples/minimal.figure.json \
  skills/figthread/examples/minimal.visual.json \
  skills/figthread/examples/minimal.layout-target.json \
  skills/figthread/examples/minimal.motion.json \
  --out browser-text-evidence.json \
  --observation-out browser-text-observation.json
```

The browser executable is resolved from `FIGTHREAD_CHROME`, `--browser`, or common Chrome/Chromium names and installation paths. Absence of a supported browser is a hard evidence failure, not permission to substitute estimated text metrics.

A successful promotion records `browser_text_extent_certified: true` and `platform_font_identity_certified: true` for the captured environment. The latter is explicitly environment-specific; Figthread does not claim that every operating system resolves the same font.

## Full benchmark dogfood

`benchmarks/e2e-dogfood/` drives the actual runtime through the complete long-running workflow rather than testing validators in isolation.

The benchmark source requires the terminal pipeline node to be named **Delivered Result**. The first semantic revision deliberately uses **Output**. That revision passes core semantic/grammar/visual/layout/render gates, but exact artifact review finds the source-fidelity defect. The run reopens `figure-ir`, advances every affected started stage to a new revision, regenerates descendants, reviews again, exports, and completes.

Worker A and Worker B are separate Node processes. Worker B reconstructs promoted authority from the run directory instead of process memory or conversation history.

Run it with:

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

The installed skill uses `node <skill-root>/scripts/workspace.mjs ...`; repository npm commands are developer conveniences.

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
npm run export:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json skills/figthread/examples/minimal.export.json --out figure.svg
```

## Determinism boundary

Semantic, grammar, visual, profile, layout, static SVG, motion, document, HTML export, and vector-safe SVG export identities are content-addressed under their declared engine inputs. Browser text evidence additionally binds the browser/platform environment because font selection and glyph shaping are environment-sensitive facts.

The browser is an observer, never canonical geometry authority.

## Next bottleneck

After browser-resolved typography proof, the next architecture bottleneck is **multi-target packaging**. The current document compiler embeds exactly one promoted target. A robust next step should compile multiple independently promoted target/layout/render branches into one document package without treating CSS scaling or runtime viewport changes as canonical geometry.
