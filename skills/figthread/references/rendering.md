# SVG rendering and rendered-profile evidence

Rendering starts only after semantic, visual, profile, and layout artifacts have been promoted. The renderer is not allowed to repair upstream meaning, primitive choice, readability thresholds, or geometry.

## Authority boundary

- `FigureSpec` supplies labels, claims, static semantic summary state, and semantic IDs.
- `PrimitivePlan` supplies the exact primitive binding, variant, local view box, interfaces, and custom local SVG.
- `ProfilePlan` supplies the selected threshold identity and target/profile contract.
- `ResolvedLayout` supplies all global boxes, anchors, and connector paths.
- the renderer supplies only SVG serialization, core primitive drawing implementation, profile-safe visual tokens, and evidence gathered from the emitted SVG.

Browser or CSS layout must not replace resolved geometry. A renderer may scale a primitive's local view box into its resolved box, but it may not move the resolved box or reroute a semantic relation.

## Static snapshot

The static renderer always uses the figure's declared semantic summary snapshot. It does not freeze an arbitrary animation frame. State channels such as queue occupancy or meter value are resolved from the promoted visual binding into that summary state.

## Core primitive coverage

The installed static SVG renderer covers every family in the bundled 24-family core registry. Core primitive implementation is deterministic and uses no randomness, wall clock, network request, or browser auto-layout.

Custom primitives reuse the validated `local_svg` content. A custom primitive that cannot provide auditable essential strokes or explicit text sizing fails the render gate instead of receiving an unverifiable certification.

## Rendered-profile evidence

The renderer audits the SVG it actually emitted. The evidence record measures:

- minimum explicit primary-label font size;
- minimum essential stroke width;
- text/background contrast;
- essential-mark/background contrast;
- grayscale-only output when the profile requires it;
- node and connector coverage;
- executable, foreign-object, and external-reference absence;
- the static semantic snapshot used by the render.

The evidence record is content-hashed and bound into the rendered-SVG promotion receipt.

Exact emitted SVG font sizes are certified by this stage. The renderer deliberately leaves `browser_text_extent_certified` false because serialized markup cannot prove browser shaping or platform-font choice. Run the browser text review after document promotion to certify actual glyph bounds and platform-font identity for a recorded browser environment. Do not reinterpret the renderer's narrower authority as permission to shrink text or patch layout downstream.

## Visual encoding rule

Color is not used as the sole visual discriminator. Primary emphasis also changes stroke weight and receives an explicit emphasis mark. Muted emphasis uses a dash pattern. State activation uses structural fill/border changes in addition to color. Paper output uses a grayscale token set.

## Diagnostics

- `RND001_BIND` — promoted semantic, visual, profile, or layout authorities are missing, tampered, or hash-mismatched.
- `RND002_PRIMITIVE` — a promoted primitive has no supported deterministic SVG implementation.
- `RND003_GEOMETRY` — required promoted box or connector geometry is missing.
- `RND004_TYPE` — emitted text lacks an explicit size or falls below the selected profile floor.
- `RND005_STROKE` — emitted essential marks fall below the selected stroke floor.
- `RND006_CONTRAST` — emitted text or essential marks fail selected contrast thresholds.
- `RND007_GRAYSCALE` — a grayscale-required profile emits non-grayscale color.
- `RND008_PURITY` — emitted SVG contains executable, foreign-object, or external-reference content.
- `RND009_CUSTOM` — custom SVG cannot provide auditable renderer evidence.
- `RND010_EVIDENCE` — a renderer evidence limitation is recorded explicitly.

## Recovery rule

Repair the owning cause. Primitive failure reopens visual binding or the primitive implementation. Missing geometry reopens layout. Threshold failure reopens renderer tokens or the profile-safe visual implementation. Semantic state mismatch reopens semantic or visual state binding. Browser text evidence failure reopens the earliest copy, typography, primitive measurement, profile, or layout cause. Never hand-edit the promoted SVG to make an audit pass.
