---
name: figthread
description: >-
  Design, validate, and package publication-ready semantic figures and
  explanatory motion artifacts from claims, papers, data, or system concepts.
  Use when the reader must follow a clear visual thread from claim to structure,
  evidence, and deterministic motion; do not use for decorative graphics without
  an explanatory claim.
---

# Figthread

Turn a claim into one legible explanatory thread. The static figure is the
authoritative communication surface; motion is a semantic layer that makes
change, route, accumulation, or comparison easier to read.

## Non-negotiables

- Figure first, motion second. Removing motion must leave the thesis and major
  relationships understandable.
- Keep semantic meaning separate from rendered geometry. `FigureSpec` owns
  claims, nodes, relations, states, and composition; layout owns coordinates,
  ports, routes, and text wrapping.
- Use one root grammar per figure. Promote independent reading axes to
  `multi-panel` or separate figures instead of inventing an arbitrary hybrid.
- Every semantic object must have a claim witness, directly or through a
  descendant. Remove decorative objects from the semantic IR.
- Use integer millisecond time and pure evaluation. The same document hashes and
  `time_ms` must reproduce the same semantic state and sampled cue values.
- Never present a plausible visual as quantitative evidence. Record source,
  assumptions, units, target profile, and limitations when the figure makes a
  domain claim.

## Workflow

1. **Understand** — identify the audience, primary question, takeaway, source
   provenance, target medium, and exclusions.
2. **Extract claims** — classify primary, supporting, contrast, and evidence
   claims. Mark must-preserve claims and give each a stable `claim:` ID.
3. **Author FigureSpec** — create the semantic registry and explicit composition
   from [templates/figure-spec.json](templates/figure-spec.json). Use stable IDs
   for every claim, node, relation, state, and snapshot.
4. **Run the gate** — check uniqueness, typed references, parent reachability,
   claim witnesses, state domains, static snapshot coverage, and geometry
   exclusion before any layout or renderer work. The repository implementation
   is `npm run validate -- <figure-spec.json>`.
5. **Plan the visual** — choose grammar, primitive vocabulary, hierarchy,
   emphasis, profile, and target size. Keep layout decisions downstream from
   validated semantics.
6. **Author MotionSpec when needed** — describe semantic events, state effects,
   and relation-anchored cues. Motion may reference resolved layout but never
   own paths or raw DOM selectors.
7. **Render and inspect** — produce the canonical self-contained HTML first;
   derive SVG/PNG only from the same promoted semantic state. Inspect the exact
   target size, print state, and reduced-motion state.
8. **Repair upstream causes** — classify defects as claim, semantics, grammar,
   layout, renderer, motion, or evidence defects. Reopen the owning stage and
   rerun the gate after semantic edits.

## Contracts

### FigureSpec

The minimum semantic document contains `schema_version`, `id`, `profile`,
`figure_type`, `thesis_claim_id`, `claims`, `nodes`, `relations`, `states`,
`composition`, `snapshots`, `static_snapshot_id`, and `extensions`. The current
contract is `figthread.figure/0.1`. Read [figure-ir.md](references/figure-ir.md)
when defining or reviewing these fields.

### MotionSpec

Use semantic `events`, `effects`, and `cues` with integer `at_ms` and
`duration_ms`. A transfer cue refers to a subject and semantic relation; the
compiler obtains its path from `ResolvedLayout`. Raw `x/y/path/d`, arbitrary
callbacks, wall-clock state, randomness, and network reads are not canonical
MotionSpec inputs. Read [motion-ir.md](references/motion-ir.md) for the core DSL.

### ArtifactBundle

The default artifact is a single HTML file with no required runtime dependency.
It must provide a readable static summary, print behavior, reduced-motion
behavior, deterministic seek, and compact provenance. Static export is a
requested derivative, not a replacement for the canonical semantic source.

## Profile routing

Choose one target profile before composition:

- `paper` — print-safe vector clarity, grayscale survivability, complete static
  summary.
- `paper-animated` — static-first supplement with restrained deterministic
  motion.
- `presentation` — large hierarchy and paced progressive reveal.
- `technical-explainer` — mechanism, system, or algorithm clarity with semantic
  loop cues.
- `infographic` — broad audience readability and accessible explanatory form.

When a request names a profile, preserve its readability contract even if the
visual style changes. Never shrink essential labels to hide a density failure.

## Local verification

In this repository, run:

```bash
npm test
npm run validate -- examples/minimal.figure.json
```

Use `npx skills add <owner>/<repo> --agent claude-code` or
`npx skills add <owner>/<repo> --agent codex` to install this skill from the
repository. The installable unit is `skills/figthread/`; root-level examples and
the development package remain repository tooling.
