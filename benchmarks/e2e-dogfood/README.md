# End-to-end execution dogfood

This benchmark exercises Figthread as a long-running worker protocol rather than as isolated validators.

It uses `source.md` as exact intake provenance and deliberately starts with a semantically valid but source-inaccurate terminal label. The first worker promotes understanding, claims, semantic figure state, grammar/visual authority, profile/layout authority, and the exact static render, then creates a handoff checkpoint and exits.

A second Node process resumes from the run directory without process memory. It reconstructs promoted authority from stage artifacts, completes motion and document promotion, inspects the exact rendered SVG and HTML, records the terminal-wording mismatch at review, promotes that review evidence, and reopens `figure-ir` rather than compensating downstream.

The repaired revision is then compiled again through grammar, visual, profile, layout, render, motion, document, review, and SVG export. The benchmark verifies that prior `r0001` bytes remain unchanged, all already-started descendants advance to `r0002`, the final exact artifact contains `Delivered Result`, and the run verifies as complete.

Run it from the repository root:

```bash
node benchmarks/e2e-dogfood/run.mjs all
```

For explicit worker separation:

```bash
node benchmarks/e2e-dogfood/run.mjs phase-a --root /tmp/figthread-dogfood
node benchmarks/e2e-dogfood/run.mjs phase-b --run <run-dir-from-phase-a>
```

The runner writes a full external-memory run directory and a receipt-bound `DOGFOOD_REPORT.md` under the final export revision.
