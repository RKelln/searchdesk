# Kits

Each `.txt` file here is one feature brief packed with everything a free AI chat needs to build it: the instructions, the contract, the example and the brief. Copy a whole file into a chat, then save the reply as `features/<id>.js`. Do not edit these by hand: `uv run tools/kit.py` writes them again from `docs/features/`, and `uv run tools/kit.py --check` says if any is out of date.

A brief you write yourself works exactly the same way. Save it as `docs/features/<id>.md` and run the tool again. See "A feature of your own" in [`../KITS.md`](../KITS.md).

There is also `index.html` here: open it in a browser for the same list with a Copy button on each one.
