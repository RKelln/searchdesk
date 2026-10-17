---
description: Run every check in the repo
---

Run the checks in `AGENTS.md`, in this order and no others:

1. `node --test tests/unit/*.test.js` (keep the glob; Node 22 rejects a folder)
2. `uv run tests/unit/test_build.py`
3. `node checks/run.js example`
4. `node checks/run.js <id>` for every id in `Desk.features` in `features/list.js`

If `uv` is not installed, say so and run the rest.

Report each one by name with the number that passed or failed. Fix nothing unless I ask.
