---
name: song-ad
description: Format guide for `song_ad` jobs, a VidLab Song Ad (an original song sung by an animated character) finished with the renderer. Load when job.format is song_ad.
---

# Song ad

VidLab's `song-ad` system writes and sings an original song about the product and animates a character singing it. The renderer then adds the hook, the overlays and the end card.

## Steps

1. **Budget.** A song ad is the most expensive format and the system names no price up front. `vidlab_song_ad` sends the remaining budget as its spending limit and cancels the run if it would pass it. If the budget is under a few dollars, expect a refusal: then make a `motion_vsl`-style video instead and say so in the summary.
2. **Brief the song.** `prompt`: the product in one sentence, the idea of the song, the mood and genre, the length wanted (the system's range is 30 s to 3 min; ask for the shortest that fits, "about 30 seconds"). `brief`: the facts it may use and the safety rules in plain words ("do not mention earnings, money amounts other than $5, investing or trading"). If the job has a `script`, pass it as `lyrics`: it is sung word for word, so `safety_check` it first.
3. **Run it.** `vidlab_song_ad`, save as `song.mp4`. It takes several minutes. Read `lyrics_or_text` in the answer and `safety_check` what was sung.
4. **Look.** `media_info` for the length and `frames` at five moments. If the lyrics or pictures break the safety rules, do not use the video: fall back as in step 1.
5. **Plan.** Scene 1: `footage` with `url: "song.mp4"`, `clipSeconds` = its length, `volume: 1`, from 0 to its length; add a `tag` (the product name) and a one or two line `head` that appears in the first half second. Scene 2: `cta`, 2.5 s, with `cue: 0.3`. No `voiceover_url`, no `music`, and `"captions": {"enabled": false}` because there are no word timings for a song.
6. **Validate, render, look at frames (start, middle, end card), finish.** The `script` you hand in is the lyrics.

## Notes

- The song video is already 9:16; `fit: "cover"` is right. If it has its own burned-in captions, do not add a headline over them: keep only the tag.
- Do not cut or reorder the song.
