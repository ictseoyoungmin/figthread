# Figthread

Figthread is a semantic figure authoring system. The current implementation slice is **D-001: FigureSpec structural + semantic promotion gate**. Layout, motion compilation, rendering, and export remain downstream work.

## Source of truth

The installable skill is self-contained under `skills/figthread/` and is the implementation source of truth for D-001:

- `skills/figthread/schemas/figure-spec.schema.json` — FigureSpec 0.1 structural contract
- `skills/figthread/runtime/` — canonical hashing, structural validation, semantic validation, promotion
- `skills/figthread/scripts/validate.mjs` — cwd-independent validator CLI
- `skills/figthread/examples/minimal.figure.json` — passing canonical fixture
- `skills/figthread/references/figure-ir.md` — normative D-001 contract

Root `src/` and `test/` are repository development harnesses and import the skill runtime rather than maintaining a second validator implementation.

## D-001 gate

Validation is layered:

1. JSON Schema structural validation (`SCH001`)
2. core semantic invariants (`IR001`–`IR009`)
3. gate promotion with deterministic content hash

Only `mode: gate` with zero errors is promotion-eligible. Draft mode is non-authoritative.

```bash
npm test
npm run validate -- skills/figthread/examples/minimal.figure.json
npm run validate:promote -- skills/figthread/examples/minimal.figure.json
```

The CLI prints deterministic JSON. A failed gate exits non-zero.

## Installable skill

```bash
npx skills add ictseoyoungmin/figthread --agent claude-code
npx skills add ictseoyoungmin/figthread --agent codex
```

When installed, do not assume the user's working directory is this repository. Resolve the installed `skills/figthread/` directory and invoke its own `scripts/validate.mjs`.

## Current invariant coverage

- global stable-ID uniqueness
- typed reference integrity, including composition, grammar role bindings, emphasis, and snapshots
- parent cycle detection and root reachability
- primary/must-preserve claim witness reachability
- recursive descendant claim witness
- state domain validation and static-summary reproducibility
- geometry exclusion recursively through arrays and objects
- namespaced extensions
- deterministic issue ordering
- draft/gate distinction and promotion hash

The next implementation slice should consume only `validated_figure` output from this gate.
