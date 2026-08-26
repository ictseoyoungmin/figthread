# Profile thresholds and measurement refinement

A profile is a certification contract for a target medium, not an aesthetic preset. It strengthens primitive geometry with readability floors, limits explanatory density, and constrains motion so that a figure remains legible at the intended target.

## Authority boundary

- `FigureSpec` chooses the profile and owns semantic meaning.
- `PrimitivePlan` owns primitive-derived intrinsic minimum and preferred sizes.
- The profile registry owns readability, spacing, density, contrast, grayscale, and motion thresholds for the five built-in profiles.
- `ProfilePlan` combines the selected profile threshold with a specific target and promoted primitive plan.
- Profile refinement may only strengthen primitive measurements and layout spacing floors. It may never shrink a primitive below its declared minimum.
- `ResolvedLayout` consumes the refined measurements and target options from a promoted profile plan.
- Motion promotion must satisfy both semantic motion validation and the selected profile's motion envelope.

The browser, renderer CSS, or a downstream export step may not silently relax a profile threshold.

## Built-in profiles

The bundled registry defines five certification profiles:

| profile | reference target | primary / auxiliary type floor | essential / hairline stroke | node gap | density hard ceiling | motion |
| --- | --- | --- | --- | --- | --- | --- |
| paper | 178 mm double-column, height up to 225 mm | 7.5 pt / 7 pt equivalent | 0.60 pt / 0.40 pt equivalent | 8 pt equivalent | 24 weighted semantic items | disabled |
| paper-animated | 1200×800 | 14 px / 12 px | 1.25 px / 1 px | 16 px | 20 weighted semantic items | bounded |
| presentation | 1920×1080 | 24 px / 20 px | 2 px / 1.5 px | 24 px | 14 weighted semantic items | bounded, repeat off |
| technical-explainer | 1200×900 desktop with 390×844 mobile proof target | 15 px / 12 px | 1.5 px / 1 px | 18 px | 30 weighted semantic items | bounded |
| infographic | 1200×1500 | 16 px / 13 px | 1.5 px / 1 px | 20 px | 36 weighted semantic items | bounded |

Paper point floors are converted to device-independent pixel equivalents for the current geometric solver. They remain physical-size certification targets, not claims about any journal or venue. A later renderer/export audit must validate the artifact at its actual placement size.

## Density accounting

Density counts explanatory semantic objects, not primitive implementation details.

- `panel` and `group` nodes do not consume semantic-item slots.
- ports, arrowheads, decorative marks, and primitive-internal cells do not consume semantic-item slots.
- a normal semantic node consumes one slot.
- an `S3` thesis-bearing or novel node consumes two slots.
- relations are counted separately.
- panel-local budgets are evaluated inside the nearest primary panel.

A hard budget violation fails the profile gate. A single soft-budget exceedance of no more than 20% is a warning. Exceeding a soft budget by more than 20%, or exceeding two or more soft budgets at once, fails the gate.

Density failures must be repaired by reducing prose, selecting a more compact grammar, splitting a panel, or using an overview/detail composition. Do not solve density failures by shrinking text below its floor.

## Profile-owned measurement refinement

The current runtime does not ask the agent to author font measurements. Instead it derives a deterministic conservative text floor from the promoted semantic label and the selected profile:

1. choose the profile's primary label floor;
2. apply the profile's deterministic average advance and padding model;
3. compare that text floor with the primitive's intrinsic minimum;
4. keep the larger width and height;
5. raise preferred size when needed so preferred size never falls below the strengthened minimum;
6. hash the resulting measurement set into the promoted profile plan.

This bridge is intentionally conservative and deterministic. It is not a claim that a browser has shaped the final glyphs. The static renderer separately certifies serialized SVG font size, stroke, contrast, grayscale, and purity. Browser text review then measures the exact promoted SVG in Chrome/Chromium and certifies actual glyph bounds, visibility, overflow/overlap, and platform-font identity for the recorded environment. Neither evidence stage may mutate profile or layout authority to manufacture a pass.

## Spacing floor

The selected profile may strengthen `min_gap` and, when necessary, `preferred_gap`. The adjustment is recorded in the profile plan. A target request can ask for more space, but not less than the profile floor.

Presentation targets additionally require at least a 5% safe margin on every side.

## Motion envelope

Motion is validated after profile promotion and before semantic motion promotion.

The profile gate checks:

- whether motion is allowed at all;
- cue-duration minimum and maximum;
- minimum spacing between positive-duration semantic beats;
- whether repeat autoplay loops are permitted;
- repeat-loop duration where a range is defined;
- peak simultaneous moving semantic groups.

`paper` rejects explanatory motion. `presentation` allows staged motion but rejects repeat autoplay by default. Static, print, and reduced-motion behavior still uses the semantic summary snapshot owned by the figure.

## Diagnostics and recovery

Profile failures use `PRF` diagnostics.

- `PRF001_TARGET` — profile/target mismatch, invalid target, or target-specific safe-margin failure.
- `PRF004_SPACING` — the profile had to strengthen a requested spacing floor.
- `PRF006_DENSITY` — semantic or relation density exceeds soft/hard budgets.
- `PRF007_MOTION` — motion violates the selected profile envelope.

Other reserved profile diagnostics are not repurposed as shortcuts for renderer or browser checks.

Repair at the owning stage:

- target mismatch or safe margin → target/profile;
- density → grammar/hierarchy/claim compression;
- spacing → layout target;
- motion envelope → motion storyboard;
- serialized font/stroke/contrast/grayscale proof → renderer;
- browser-shaped glyph bounds, overflow/overlap, and platform-font proof → browser text review, reopening copy/measurement/profile/layout if it fails.

Do not patch exported pixels, browser measurements, or renderer offsets to hide a profile-gate failure.
