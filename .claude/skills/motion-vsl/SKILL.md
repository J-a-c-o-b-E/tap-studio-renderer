---
name: motion-vsl
description: Format guide for `motion_vsl` jobs, a voiced motion-graphics video made entirely with the renderer. Load when job.format is motion_vsl.
---

# Motion VSL

A faceless, voiced motion-graphics video: every frame is a renderer scene. Default length 30 s (use `duration_s` when given). VidLab is used only for the voiceover.

## Steps

1. **Script.** Use `job.script` word for word if given. Otherwise write one from the product, facts and brief: about 2.6 words per second of target length. Structure: hook (first line names the viewer's situation, first word within 0.3 s) → what it is → what you get (the facts) → the price → call to action. Short spoken sentences, one idea per line. `safety_check` it.
2. **Voiceover.** `make_voiceover` with one entry per sentence or clause (8 to 25 lines for 30 to 60 s). `text` is how it is said ("five dollars", "two hundred and forty plus", "Tapp" for TAP so it is not spelled out); `caption` is how it is shown ("$5", "240+", "TAP").
3. **Plan.** Load `editing`. One scene per line or pair of lines, cut on the line start times from the tool's answer. Set `"voiceover_url": "voiceover.mp3"`, leave out `words`, add the music bed unless `job.music` is false. Give the last scene (`cta`) at least 1.5 s after the last word by setting `duration` on the plan to the voiceover length + 1.6.
4. **Validate, render, look, fix, finish.**

## Scene choices that work

| Line is about | Scene |
|---|---|
| The hook: who this is for, what they lack | `pills` with `flip` and a `tape`, or `strike_list` |
| A sharp statement or question | `headline` (2 lines, alternate backgrounds) |
| How it works, where people post | `phones`, `swipe_phone`, `icon_flow` |
| Who is behind it, proof by numbers given in the job | `logo_stats` |
| The product | `product_box` (with `lessons` when you list what is inside) |
| What is included, in order | `steps`, `checklist`, `big_number` |
| The price | `price_tag` |
| Limited launch, if the job says so | `launch_grid` |
| The close | `cta`, always last |

Alternate cream, orange and black backgrounds so no two neighbours match. Aim for a new scene every 3 to 6 seconds.
