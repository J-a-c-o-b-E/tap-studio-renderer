import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Placed, SceneWord } from "./plan";

/* Timing helpers shared by every scene. */

export const W = 1080;
export const H = 1920;
export const ORANGE = "#F7A12E";
export const BLACK = "#0A0A0A";
export const CREAM = "#F4EFE6";
export const GREY = "#1C1C1E";
export const RED = "#E5432D";
export const ANTON = "TapAnton";
export const INTER = "TapInterTight";

/** Safe zone: everything important sits inside x 64-1016, y 250-1260. Captions sit just below, at y ~1340. */
export const X0 = 64;
export const SW = 952;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const prog = (frame: number, start: number, len = 12) => interpolate(frame, [start, start + len], [0, 1], { ...clamp, easing: ease });
export const spr = (frame: number, fps: number, at: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) =>
  frame < at ? 0 : spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 170, mass: 0.65, ...cfg } });

export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");

/** A cue is a spoken word (matched by prefix, in order, inside the scene) or a number of seconds from the scene start. */
export type Cue = string | number | undefined | null;

export const cueFrames = (words: SceneWord[], cues: Cue[], fps: number, dur: number): number[] => {
  let from = 0;
  return cues.map((c, i) => {
    const fallback = Math.round((dur * 0.8 * i) / Math.max(1, cues.length));
    if (c == null || c === "") return i === 0 ? 0 : fallback;
    if (typeof c === "number") return Math.round(c * fps);
    const n = normalize(c);
    for (let k = from; k < words.length; k++) {
      const w = normalize(words[k].text);
      if (w === n || w.startsWith(n)) {
        from = k + 1;
        return words[k].start;
      }
    }
    return fallback;
  });
};

export type SceneProps = { scene: Placed; props: Record<string, any> };

/** Cue frames for this scene (scene-local frames). */
export const useCues = (scene: Placed, cues: Cue[]) => {
  const { fps } = useVideoConfig();
  return cueFrames(scene.words, cues, fps, scene.dur);
};

/** Pop in: scale 0.9 -> 1 over 5 frames (150 ms), ease-out back. */
export const usePop = (at: number, from = 0.9) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  return { scale: from + (1 - from) * p, opacity: frame < at ? 0 : Math.min(1, (frame - at + 1) / 2), on: frame >= at };
};

export const popAt = (frame: number, at: number) => {
  const p = interpolate(frame, [at, at + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  return { scale: 0.4 + 0.6 * p, opacity: frame < at ? 0 : 1 };
};

/** `text` is the documented key; `t` is accepted as a short form. */
export const tx = (o: any): string => (typeof o === "string" ? o : (o?.text ?? o?.t ?? ""));
