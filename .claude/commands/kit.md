---
description: Rebuild the free-chat kits
---

Run `uv run tools/kit.py` (or `python3 tools/kit.py`), then tell me which files changed and whether
any kit passed 60,000 characters, since a free chat may choke on a kit that big.

Then run `node --test tests/unit/kits.test.js` to confirm the kits match their briefs.

Do not hand-edit anything in `docs/kits/`: the next run writes it again.
