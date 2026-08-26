# Deterministic request pipeline benchmark

A request enters a deterministic processing pipeline. It passes through an explicit queue so intermediate state is visible before the request becomes the delivered result.

The figure must preserve two claims:

1. A request moves through the pipeline in a fixed order.
2. The queue exposes intermediate state and may contain one item in the summary state.

The reading order is left to right: **Input → Queue → Delivered Result**.

The terminal node must be labeled **Delivered Result**. The generic label “Output” is intentionally considered too weak for this source because it loses the delivery meaning.

For explanatory motion, show the queue receiving one item, then transfer that item toward the delivered result, then reset the queue before the loop boundary. The static/export view must use the declared summary state rather than an arbitrary animation frame.
