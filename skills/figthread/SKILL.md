---
name: figthread
description: >-
  Design and validate publication-ready semantic figures from claims, papers,
  data, or system concepts. Use when the reader must follow a clear visual
  thread; do not use for decorative graphics without an explanatory claim.
---

# Figthread

Figure first, motion second. D-001 is the mandatory semantic gate: no layout or renderer work may treat an unpromoted FigureSpec as authoritative.

## Required reading for D-001

Read, in order:

1. [references/figure-ir.md](references/figure-ir.md)
2. [schemas/figure-spec.schema.json](schemas/figure-spec.schema.json) when authoring or debugging structure
3. [templates/figure-spec.json](templates/figure-spec.json) as a starting shape

## D-001 workflow

1. Understand source provenance, audience, target profile, exclusions, and primary question.
2. Extract primary/supporting/contrast/evidence claims and assign stable `claim:` IDs.
3. Author `FigureSpec 0.1` with semantic nodes, relations, states, explicit composition, emphasis, and static summary snapshot.
4. Run the skill-local validator before layout:

```bash
node <skill-root>/scripts/validate.mjs <figure-spec.json> --mode gate
```

Do **not** run `npm` in the user's project as a substitute for the installed skill runtime. Resolve `<skill-root>` from this `SKILL.md` location.
5. If the report fails, repair the owning semantic cause and rerun the gate. Do not compensate downstream.
6. Promote only after a zero-error gate:

```bash
node <skill-root>/scripts/validate.mjs <figure-spec.json> --promote
```

7. Pass only the promoted `validated_figure` to future layout work.

## Non-negotiables

- `FigureSpec` owns meaning; layout owns coordinates/ports/routes/wrapping.
- Every non-root semantic node reaches `composition.root_id` through `parent_id`.
- Every primary/must-preserve claim has a witness in the reading composition.
- Every semantic node directly or recursively serves a claim.
- The static snapshot explicitly reproduces every `StateSpec.summary` value.
- Resolved geometry is forbidden anywhere in semantic IR, including nested arrays.
- Extensions are namespaced and never silently ignored.
- Draft mode is non-authoritative. Only a gate pass may promote.
- Validation reports are deterministic; file existence or plausible visuals are not proof.

## Output contract for this slice

The D-001 deliverable is:

- a FigureSpec JSON document,
- a deterministic ValidationReport,
- and, on gate success, a content-hashed promotion receipt plus `validated_figure`.

LayoutIntent, ResolvedLayout, MotionSpec compilation, HTML rendering, and export belong to later slices.
