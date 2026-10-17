# Kits

Each `.txt` file here is one feature brief packed with everything a free AI chat needs to build it: the instructions, the contract, the example and the brief. Copy a whole file into a chat, then save the reply as `features/<id>.js`. Do not edit these by hand: `uv run tools/kit.py` writes them again from `docs/features/`, and `uv run tools/kit.py --check` says if any is out of date.
