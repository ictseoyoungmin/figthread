# Execution workspace

Long-running figure work uses a run directory as external memory. Conversation history, a screenshot, or the existence of a file is not completion proof. A stage becomes authoritative only when its exact artifacts and review evidence are bound into an immutable promoted receipt.

## Run structure

```text
run-<date>-<source8>/
├── run.json
├── intake/
├── stages/
│   ├── 01-understanding/
│   ├── 02-claims/
│   ├── 03-figure-ir/
│   ├── 04-grammar-visual/
│   ├── 05-layout/
│   ├── 06-motion/
│   ├── 07-document/
│   ├── 08-review/
│   └── 09-export/
├── receipts/
├── checkpoints/
├── evidence/
├── logs/
├── final/
└── tmp/
```

Each active stage has a revision directory such as `stages/03-figure-ir/r0001/`. Reopening creates a new revision rather than modifying promoted history.

## Stage order

The execution frontier advances through:

`understanding → claims → figure-ir → grammar-visual → layout → motion → document → review → export`

Every stage must promote. When motion is intentionally absent, promote an explicit no-motion decision artifact and its evidence instead of silently skipping the motion stage.

## Starting a run

Create the workspace from the exact source file:

```bash
node <skill-root>/scripts/workspace.mjs init <runs-root> <source-file>
```

The runtime copies the source into `intake/`, hashes its exact bytes, creates the stage directories, opens the first revision, and creates the first checkpoint. Use `--run-id` only when a caller needs a stable explicit run name.

## Resume protocol

A fresh worker must begin with:

```bash
node <skill-root>/scripts/workspace.mjs resume <run-dir>
```

Resume verifies the run manifest hash, intake provenance, active receipt chain, exact artifact bytes, exact evidence bytes, and latest checkpoint. It then reports either:

- `ready` with the active frontier and revision directory;
- `complete` when every stage has a valid active receipt; or
- `reopen-required` with the earliest invalid stage.

A worker must be able to continue from this packet and the run directory without conversation history.

## Promoting a stage

Write the stage outputs inside the reported active revision directory. Put review evidence inside the run directory, normally under `evidence/`. Then promote:

```bash
node <skill-root>/scripts/workspace.mjs promote <run-dir> <stage> \
  --artifact <run-relative-or-contained-path> \
  --evidence <run-relative-or-contained-path>
```

Repeat `--artifact` and `--evidence` as needed. `--authority name=sha256:...` may bind promoted figure/layout/render/document/export identities into the receipt when a stage consumes those authorities.

Promotion is fail-closed:

- the stage must be the active frontier;
- at least one artifact and one evidence file are required;
- artifact paths must remain inside the active revision directory, except promoted export deliverables may also live under `final/`;
- every path must remain inside the run directory;
- receipt content, artifact-set content, evidence-set content, source provenance, and predecessor receipt are content-hashed;
- promotion automatically creates a checkpoint.

Receipts and checkpoints are immutable content-addressed records. Do not edit them after creation.

## Reopen and recovery

When review finds an earlier cause, reopen the earliest causal stage:

```bash
node <skill-root>/scripts/workspace.mjs reopen <run-dir> <stage> --reason "<cause>"
```

Reopen never patches promoted history. It creates the next revision for the selected stage, removes that stage and all descendants from the active receipt chain, records the invalidated receipt hashes, and leaves their files in place for audit.

If verification discovers changed artifact or evidence bytes, `resume` reports the earliest invalid stage. Reopen at that stage or an earlier causal stage. Reopening a later stage is rejected.

A damaged run manifest or changed intake source is not repaired by reopen because the execution provenance itself is no longer trustworthy. Restore the original provenance or start a new run.

## Checkpoints

Promotion and reopen create checkpoints automatically. A manual checkpoint is available for meaningful handoff boundaries:

```bash
node <skill-root>/scripts/workspace.mjs checkpoint <run-dir> --reason "handoff"
```

A checkpoint records the active receipt set, revision counters, current frontier, and previous checkpoint hash. It is a resumable state snapshot, not a substitute for stage evidence.

## Single-writer rule

Mutating operations use an exclusive `.figthread-writer.lock`. Readers may verify or resume concurrently, but there must be only one writer.

After a confirmed process crash, and only after verifying that no writer still owns the workspace, recover a stale lock explicitly:

```bash
node <skill-root>/scripts/workspace.mjs recover-lock <run-dir> --reason "confirmed crashed worker"
```

Lock recovery writes a content-hashed audit record under `logs/` before removing the stale lock. Never use lock recovery merely to bypass a busy workspace.

## Diagnostics

- `EXE001_RUN` — run manifest or run identity failure
- `EXE002_SOURCE` — intake provenance failure
- `EXE003_RECEIPT` — receipt structure, hash, or chain failure
- `EXE004_ARTIFACT` — promoted artifact missing or changed
- `EXE005_EVIDENCE` — promoted evidence missing or changed
- `EXE006_FRONTIER` — stage order/frontier violation
- `EXE007_LOCK` — single-writer lock conflict or recovery issue
- `EXE008_CHECKPOINT` — checkpoint structure/hash/snapshot failure
- `EXE009_REOPEN` — invalid reopen request
- `EXE010_PATH` — path escapes the run directory or violates revision ownership

Repair the earliest causal failure. Do not compensate downstream or mark a run complete because a final-looking file happens to exist.
