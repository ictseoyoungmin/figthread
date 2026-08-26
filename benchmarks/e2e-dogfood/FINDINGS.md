# Dogfood findings

## Finding 001 — descendant revision reuse on causal reopen

**Severity:** high

The first full execution dogfood exposed a history-preservation defect in the workspace runtime. Reopening `figure-ir` invalidated downstream receipts but reset downstream revision counters to zero. When the repaired pipeline advanced again, stages such as `grammar-visual`, `layout`, `motion`, `document`, and `review` could reuse `r0001` directories.

That behavior contradicted the execution contract: a reopen must create a new causal revision and must never patch or overwrite a prior promoted history branch.

### Repair

The reopen runtime now advances every already-started affected revision, including the current unpromoted frontier. Stages that never started remain at revision zero and still begin at `r0001` when first reached.

For a review-time reopen of `figure-ir` after `review` has promoted, the expected revision state is therefore:

```text
figure-ir       r0002
grammar-visual  r0002
layout          r0002
motion          r0002
document        r0002
review          r0002
export          r0002  # r0001 was already the open frontier
```

The benchmark keeps the prior `r0001` document bytes and asserts that they remain byte-identical after the repaired run completes.

### Regression coverage

- `test/execution-reopen-revision.test.js` isolates the revision-history invariant.
- `test/benchmark-dogfood.test.js` exercises the full semantic → grammar/visual → profile/layout/render → fresh-worker resume → motion → document → review → reopen → repaired pipeline → export path.

No downstream layout, renderer, document, or export patch is allowed to hide the source-wording mismatch; the benchmark requires reopening `figure-ir` and regenerating descendants.
