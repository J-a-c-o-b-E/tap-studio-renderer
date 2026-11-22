---
name: editing
description: How to cut and lay out a renderer plan so it looks like the TAP reference ads (pacing, scene timing, cues, text length, backgrounds). Load before writing any plan.
---

# Editing a plan

Read `docs/scenes.md` for the props of the scenes you plan to use, and one plan in `examples/` for a complete, working reference. Copy their shapes.

## Timing

- **Cut on the voice.** A scene starts on the first word of its line (the line `start` from `make_voiceover`, minus 0.05 s). Scenes run back to back: `end` of one is `start` of the next.
- **Pace.** A new scene every 3 to 6 s; nothing on screen longer than 7 s without something new appearing.
- **First frame.** Something is on screen at frame 0 and the first word lands within 0.3 s. Never open on an empty background.
- **End card.** `cta` is last and holds at least 1.5 s after the final word.
- **Total length.** Set the plan's `duration` yourself: last word end + 1.6 s.

## Cues

- A cue is a word spoken in that scene, written the way the caption shows it, lower case, without punctuation: `"zero"`, `"240"`, `"5"` for "$5", `"1on1"` for "1-ON-1". It matches by prefix, in order.
- Each element appears when its word is said. If no word fits, use seconds from the scene start (`0.4`).
- Do not reuse the same word as two cues in one list; the second one will not be found.

## Text

- Uppercase, no wrapping: 12 to 16 characters per line at headline sizes. Split long lines into two.
- `*word*` puts the orange highlight on the word that carries the meaning. One highlight per line.
- On-screen text supports the voice, it does not repeat the sentence: two to four words.
- Check spelling of every on-screen string and every caption.

## Look

- Backgrounds: alternate `cream`, `orange`, `black`. Some scenes have a fixed background (see the docs): plan the order around them.
- Use each scene type at most twice per video, and never twice in a row.
- A `tape` banner belongs on the first scene only.
- Everything important stays inside x 64–1016, y 250–1260; the scenes already do this, so do not fight them with long text.

## Before rendering

`validate_plan` must say `OK` with no `safety_findings`. After rendering, look at a frame from the middle of every scene: text cut off at an edge, two elements on top of each other, or an empty scene means fix the plan and render once more.
