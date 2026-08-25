# MotionSpec reference

Motion is a deterministic semantic program compiled only after semantic, profile, and layout artifacts have passed their promotion gates. It is not a list of CSS animations or per-beat DOM callbacks. The selected profile's motion envelope is validated before semantic motion promotion.

## Core records

```text
MotionSpec {
  id,
  figure_id,
  mode,
  timeline: {
    duration_ms,
    loop: { mode, closure },
    beats: [BeatSpec...]
  },
  events: [EventSpec...],
  static_snapshot_id,
  extensions
}

BeatSpec {
  id, at_ms, duration_ms, order?, event_ids
}

EventSpec {
  id, kind, order?, effects?, cues?
}
```

Use `schemas/motion-spec.schema.json` and `templates/motion-spec.json` for the exact serialized contract.

## Profile envelope

Profile validation runs before semantic motion compilation and checks only target-medium constraints:

- whether motion is allowed;
- cue-duration bounds;
- minimum spacing between positive-duration semantic beats;
- repeat autoplay policy and loop duration;
- peak simultaneous moving semantic groups.

These failures use `PRF007_MOTION` and must be repaired in the storyboard or target profile. Passing the profile envelope does not replace semantic motion validation.

## Semantic effects

State effects use `set` for every domain and `add` only for numeric, count, or ratio domains. Every resulting value must remain inside the corresponding `StateSpec.domain`.

Events are scheduled through beats. Every event must be scheduled exactly once. Multiple events may share a beat, but two semantic writers may not update the same state at the same semantic time.

## Semantic cues

Supported cues are:

- `reveal` — make a semantic node newly visible or salient;
- `focus` — emphasize an already-present semantic node;
- `transfer` — move explanatory attention or a semantic subject along a declared relation;
- `trace` — reveal or emphasize a declared relation path;
- `morph-state` — visually reflect a semantic state change on a node.

Cues reference node IDs and relation IDs. They do not contain coordinates, SVG paths, layout boxes, selectors, or DOM callbacks.

## Evaluation contract

Time is integer milliseconds. Seeking starts from the promoted figure's initial semantic state, then replays scheduled effects in canonical order:

```text
beat.at_ms → beat.order → event.order → lexical event id
```

Seeking must not read the previous DOM frame. Repeating timelines must explicitly restore every semantic state to its initial value before the loop boundary. Non-repeating timelines use `closure: none`.

## Geometry boundary

Resolved geometry belongs to the promoted layout. Motion compilation may derive geometry only in `MotionProgram`:

- node cues resolve target boxes from `ResolvedLayout.boxes`;
- `trace` resolves its path from the promoted relation route;
- `transfer` resolves start, path, and end from the promoted relation route.

The promoted layout carries profile-plan identity, so a target/profile change requires layout and motion recompilation. Do not rewrite `MotionSpec` with new coordinates.

## Static and reduced-motion behavior

The motion document must name the figure's declared static summary snapshot. Static, print, and reduced-motion modes use that semantic summary state rather than freezing an arbitrary animation frame.

## Diagnostics

Profile-envelope failures are reported before these semantic motion diagnostics.

- `MOT001_BIND` — invalid upstream promotion, structural contract, or semantic reference binding.
- `MOT002_TIME` — beat or cue timing exceeds its declared timeline/window.
- `MOT003_DOMAIN` — a state effect uses an invalid operation or leaves its declared domain.
- `MOT004_GEOMETRY` — canonical motion contains resolved geometry or required promoted layout geometry is missing.
- `MOT005_CUE` — cue semantic requirements are incomplete or invalid.
- `MOT006_WRITER` — concurrent semantic writers target the same state at the same time.
- `MOT007_LOOP` — loop closure mode is invalid or semantic state does not close.
- `MOT008_STATIC` — static snapshot does not resolve to the figure's semantic summary snapshot.
- `MOT009_PURITY` — an extension or executable behavior has no registered pure compiler.

## Purity and recovery

Canonical motion extensions require a registered pure compiler with declared inputs and deterministic output. The installed runtime does not execute arbitrary extension JavaScript, callbacks, network calls, randomness, or wall-clock time.

When a motion gate fails, reopen the owning profile, semantic, layout, state-domain, timing, cue, loop, or extension cause. Do not compensate by hand-editing compiled tracks, SVG coordinates, or renderer animation code.
