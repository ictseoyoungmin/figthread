# FigureSpec 0.1 contract

`FigureSpec` is the canonical semantic IR. It must pass structural and semantic validation before layout can consume it. Resolved geometry never belongs here.

## Required top-level fields

`schema_version`, `id`, `profile`, `figure_type`, `thesis_claim_id`, `claims`, `nodes`, `relations`, `states`, `composition`, `emphasis`, `snapshots`, `static_snapshot_id`, `extensions`.

Core records:

```text
ClaimSpec    { id, role, statement, source_refs, must_preserve? }
NodeSpec     { id, kind, label?, parent_id?, order?, claim_refs, data? }
RelationSpec { id, kind, from, to, claim_refs?, extension_kind? }
StateSpec    { id, target_id, property, domain, initial, summary, claim_refs }
SnapshotSpec { id, kind, state_values }
EmphasisSpec { primary, secondary, muted }
```

## Validation layers

1. **Structural schema** — `schemas/figure-spec.schema.json` owns required fields, enums, types, patterns, and unknown-key policy.
2. **Core semantic validator** — owns reference integrity, claim reachability, parent/root correctness, domains, snapshots, geometry exclusion, and extension rules.
3. **Grammar/profile validators** — may add stricter rules for a selected grammar or target profile, but may not weaken the core semantic contract.

## Core invariants

- `IR001` — stable IDs are globally unique across claims, nodes, relations, states, and snapshots.
- `IR002` — every typed reference resolves: thesis, claim refs, parent refs, relation endpoints, state targets, composition order/root, grammar role bindings, emphasis refs, and snapshot state refs.
- `IR003` — the parent graph is cycle-free and every non-root semantic node reaches `composition.root_id`.
- `IR004` — every primary or `must_preserve` claim has a witness in the actual reading composition.
- `IR005` — every semantic node directly serves a claim or contains a descendant that does.
- `IR006` — `initial` and `summary` values belong to the declared state domain; count is a non-negative integer and numeric bounds are honored.
- `IR007` — `static_snapshot_id` resolves, every snapshot state value is domain-valid, and the static snapshot explicitly reproduces every `StateSpec.summary` value.
- `IR008` — semantic IR contains no resolved geometry (`x/y/w/h/width/height/cx/cy/path/d`), including nested arrays.
- `IR009` — extension namespaces and extension relations are explicitly namespaced.

Structural problems use `SCH001`. Issues are deterministically ordered by severity → code → object id → path → message.

## Modes and promotion

`draft` and `gate` both report structural and semantic defects. Draft mode is non-authoritative and may be used while authoring. Only a zero-error `gate` report has `promotion_eligible: true`.

`promoteFigureSpec()` returns a deeply frozen `validated_figure` snapshot plus a content-hashed promotion receipt. Downstream layout must consume only a gate-promoted snapshot.

## Recovery rule

When validation fails, repair the semantic source of the issue and re-run the gate. Do not add geometry, renderer-specific state, or downstream patches to make invalid semantic state appear acceptable.
