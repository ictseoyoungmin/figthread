# Document runtime

The canonical delivery surface is one self-contained HTML document. The document runtime is a projection of promoted figure authority; it is not a new authoring layer.

## Authority boundary

The document may embed canonical source inputs and compiled artifacts, but it may not reinterpret them.

- semantic meaning comes from the promoted figure;
- reading grammar comes from the promoted grammar plan;
- primitive binding and intrinsic measurements come from the promoted primitive plan;
- readability and target constraints come from the promoted profile plan;
- boxes and routes come from the promoted resolved layout;
- the static SVG comes from the promoted renderer output;
- animation tracks come from the promoted motion program when motion exists.

DOM state, CSS, playback time, selected mode, controls, hover state, and temporary overlay geometry are ephemeral view state. They must never be promoted back into semantic, grammar, visual, profile, or layout authority.

## Build contract

A document contains three distinct classes of state:

1. **Canonical input** — the authored figure, visual binding, layout target, and optional motion specification.
2. **Compiled authority** — promoted grammar, primitive, profile, layout, rendered evidence, and optional motion program identities and payloads.
3. **Ephemeral runtime state** — active mode, current playback time, temporary cue overlays, and sampled semantic state.

The canonical payload has its own content hash. The compiled authority chain has a compile key. The complete manifest has a build hash. A promoted document also records the exact HTML hash. Any mismatch must fail closed.

## Browser bootstrap

The embedded runtime performs a fail-closed bootstrap before reporting ready:

1. find the embedded manifest and SVG;
2. parse the manifest;
3. reject incompatible document schema;
4. verify the manifest build hash, canonical hash, and compile key;
5. verify the embedded SVG viewport and target identity against promoted layout;
6. reject external runtime dependencies;
7. hydrate runtime controls, state sampling, and cue overlays;
8. enter the requested runtime mode and report ready.

A bootstrap failure enters `error` mode and records a `DOC` diagnostic. Do not silently continue with partially verified state.

## Runtime modes

- `interactive` enables playback controls when a motion program exists.
- `clean` preserves runtime evaluation but hides authoring/playback chrome.
- `static` uses the declared semantic summary state and removes transient motion overlays.
- `error` is fail-closed and cannot be selected as a normal initial mode.

Reduced-motion and print/export preparation should prefer the static semantic summary rather than freezing an arbitrary animation frame.

## Inspection API

The document exposes `window.Figthread` with a small stable inspection surface:

- `getStatus()`
- `listTargets()`
- `activateTarget(id)`
- `renderAt(timeMs)`
- `setMode(mode)`
- `prepareExport()`
- `getStateHash()`
- `getDiagnostics()`

`renderAt()` is event-sourced from the motion program's initial semantic state. Seeking must not depend on the previous DOM frame.

The current document contains one compiled target. `activateTarget()` therefore accepts only that embedded target and fails for any other ID. Multi-target document packaging is a later capability and must not be simulated with CSS scaling.

## Motion projection

Motion cues are projected without changing canonical geometry:

- reveal and focus address promoted semantic node IDs;
- trace uses the promoted connector path compiled into the motion program;
- transfer uses the same compiled path for temporary marker position;
- morph-state marks the promoted semantic target while semantic state is sampled event-by-event.

Temporary overlay geometry is runtime-only. It cannot become a replacement connector route or node box.

## Self-contained requirement

The generated HTML may not require external JavaScript, stylesheets, fonts, images, iframes, objects, or network requests to operate. The embedded SVG namespace is metadata, not a network dependency.

If a capability requires external data, a second target, browser-authoritative layout, or an uncompiled motion callback, reopen the appropriate upstream design instead of adding a runtime escape hatch.
