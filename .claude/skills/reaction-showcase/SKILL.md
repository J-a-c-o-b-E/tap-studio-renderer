---
name: reaction-showcase
description: Format guide for `reaction_showcase` jobs, an AI reaction clip (ugc-image-1 start frame + seedance-2.5) followed by a renderer showcase of the product. Load when job.format is reaction_showcase.
---

# Reaction showcase

A short AI clip of a person reacting, with a hook headline over it, then a fast motion-graphics showcase of the product. Default length 20 s: about 4 to 6 s of reaction, the rest showcase.

## Steps

1. **Angle.** One feeling and one line of text. The reaction is curiosity, relief or "wait, that's it?", never a reaction to money. The hook line over the clip says what they are looking at ("POV: YOU FOUND A $5 COURSE"), using only facts from the job.
2. **Budget.** `vidlab_model` for `ugc-image-1` and `seedance-2.5`, then add it up: one image + clip seconds × the per-second price + a short voiceover. Pick 720p, or 480p if the budget is tight; 4 or 5 seconds.
3. **Start frame.** `vidlab_generate` with `ugc-image-1`, `aspect_ratio: "9:16"`, save as `start.png`. Prompt per the `vidlab` skill. Keep the top third of the frame calm (wall, ceiling, sky): the headline sits there. Look at it (`Read start.png`); if it shows text, money or a distorted face, make one new one with a corrected prompt.
4. **Clip.** `vidlab_generate` with `seedance-2.5`: `local_files: {"images": ["start.png"]}`, `image_mode: "first_frame"`, `duration`, `resolution`, `aspect_ratio: "9:16"`, `generate_audio: true` for room tone. Save as `reaction.mp4`. Check it with `frames`.
5. **Voiceover.** `make_voiceover` for the showcase part only, with `offset_s` equal to the reaction length so the voice starts when the showcase starts. Three to six short lines: what it is, what you get, the price, the call to action.
6. **Plan.** Scene 1 is `footage` (`url: "reaction.mp4"`, `clipSeconds`, `volume: 0.6`, `tag`, `head` with `headCue: 0.3`) from 0 to the clip length. Then showcase scenes cut on the voiceover lines (see the table in `motion-vsl`), ending on `cta`. Set `"voiceover_url": "voiceover.mp3"`; music bed on unless the job says no.
7. **Validate, render, look at frames of both parts, finish.**

## Notes

- The headline on the clip is the hook: it must be readable in the first half second (`headCue` ≤ 0.4) and at most two short lines.
- Do not put captions-worth of words on the clip: the reaction has no speech, so the caption pill stays empty there.
- If the clip cannot be made within the budget, replace it with a `headline` or `pills` hook scene and say so in the summary.
