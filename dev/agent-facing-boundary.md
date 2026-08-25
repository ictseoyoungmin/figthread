# Agent-facing source boundary

`skills/figthread/` is the installed, agent-facing product surface. Internal implementation roadmap codes such as `D-001`, `D-002`, and future `D-*` labels must not appear anywhere under that directory.

Use capability and authority names instead: semantic validation, semantic promotion, deterministic layout, layout promotion, motion compilation, rendering, export, and recovery.

Development-only roadmap codes remain allowed in repository-level developer materials such as `CHANGELOG.md`, `README.md`, `dev/`, tests, pull requests, and commit history.

The repository test suite enforces this boundary recursively for text files under `skills/figthread/`.
