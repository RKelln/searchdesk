# Notes on built features

A file here is a note about something that **is built**, not a brief for something to build.

`docs/features/` is the other folder, and it is a different thing: every file in it is a feature waiting to be
built, and `uv run tools/kit.py` packs each one into `docs/kits/<id>.txt` for someone to paste into a free chat.
That means anything in `docs/features/` is, by definition, **not built yet**. A note about finished work does not
belong there — it would be packed into a kit and handed to someone as work to do.

So when a planned feature is built, or is absorbed into another one and never becomes its own file, its note moves
here. Keep the file name, so a reference to it stays easy to follow.

Right now: [`board.md`](board.md), which was first written as its own feature and ended up as a List/Board choice
inside Jobs.