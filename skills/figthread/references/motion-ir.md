# MotionSpec 0.1 reference

Motion is a deterministic semantic program compiled after FigureSpec and
`ResolvedLayout` have passed their gates. It is not a list of CSS animations or
per-beat DOM callbacks.

## Core records

```text
MotionSpec {
  schema_version: "figthread.motion/0.1",
  id,
  figure_id,
  initial_state,
  beats: [BeatSpec...],
  loop: "none" | "repeat",
  static_snapshot_id
}

BeatSpec {
  id, at_ms, duration_ms, order?,
  events: [EventSpec...]
}

EventSpec {
  id, kind, effects?, cues?
}
```

State effects use `set` for every domain and `add` only for numeric, count, or
ratio domains. Visual cues are semantic and may use `reveal`, `focus`,
`transfer`, `trace`, or `morph-state`. Cues reference node IDs and relation IDs,
not coordinates.

## Evaluation contract

At an integer `time_ms`, evaluate from the initial semantic snapshot, apply all
effects whose beat begins at or before that time in stable order, then sample
active cue windows. The canonical order is:

```text
at_ms → beat.order → event.order → lexical stable ID
```

Seeking must not read the previous DOM frame. A repeat loop must close back to
the initial state and clear transient cues; otherwise use `loop: "none"`.
Print and reduced-motion modes render the declared static snapshot rather than
freezing an arbitrary animation frame.

## Geometry boundary

For a transfer cue, store `subject`, `via_relation`, and a time window. The
compiler resolves `start`, `path`, and `end` from layout ports and routes. If a
layout target changes, recompile tracks without rewriting MotionSpec.

Canonical extensions must be registered pure compilers with declared input and
output, no DOM/time/random/network dependency, and deterministic output.
