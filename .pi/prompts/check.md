---
description: Check one feature
argument-hint: <id>
---

Run the check for $1 the way `AGENTS.md` says: `node checks/run.js $1`, or
`bash checks/check.sh $1` on a Mac with no Node.

If something fails, fix the feature file, not the check file, then run it again. The contract scan
counts as a failure too: no `innerHTML`, `fetch`, `localStorage`, `setInterval` and the rest.

Finish by telling me, in plain words, what you ran and how many checks passed. Do not change a
check to make it pass.
