/* The video plan (see schema/plan.schema.json) and how it is laid out on the frame timeline. */

export type PlanWord = { text: string; start: number; end: number };
export type PlanScene = { type: string; start?: number; end?: number; duration?: number; continue?: boolean; props?: Record<string, any> };
export type Plan = {
  version?: number;
  aspect?: "9:16";
  fps?: number;
  duration?: number;
  tail?: number;
  voiceover_url?: string;
  words?: PlanWord[];
  music?: { url?: string; volume?: number; start?: number } | null;
  captions?: { enabled?: boolean; y?: number };
  scenes: PlanScene[];
  output?: Record<string, any>;
  webhook_url?: string;
};

/** A word, timed in frames relative to its scene. */
export type SceneWord = { text: string; start: number; end: number };
export type Placed = { index: number; type: string; props: Record<string, any>; from: number; dur: number; startS: number; endS: number; cont: boolean; nextCont: boolean; words: SceneWord[] };

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DEFAULT_FPS = 30;
export const DEFAULT_TAIL = 1.5; // the end card holds this long after the last word

/** Total length in seconds: `duration`, or the later of the last scene end and the last word end + tail. */
export const planSeconds = (plan: Plan): number => {
  if (plan.duration) return plan.duration;
  const words = plan.words ?? [];
  const lastWord = words.length ? words[words.length - 1].end + (plan.tail ?? DEFAULT_TAIL) : 0;
  let t = 0;
  for (const s of plan.scenes) {
    const start = s.start ?? t;
    t = s.end ?? (s.duration != null ? start + s.duration : start);
  }
  return Math.max(t, lastWord, 1);
};

/** Resolve every scene to a frame range. A scene runs until the next one starts; the last one runs to the end. */
export const placeScenes = (plan: Plan, fps: number): Placed[] => {
  const total = planSeconds(plan);
  const starts: number[] = [];
  let t = 0;
  for (const s of plan.scenes) {
    const start = s.start ?? t;
    starts.push(start);
    t = s.end ?? (s.duration != null ? start + s.duration : start);
  }
  const words = plan.words ?? [];
  return plan.scenes.map((s, i) => {
    const startS = starts[i];
    const endS = i + 1 < plan.scenes.length ? starts[i + 1] : total;
    const from = Math.round(startS * fps);
    const dur = Math.max(1, Math.round(endS * fps) - from);
    const mine = words.filter((w) => w.start >= startS - 0.001 && w.start < endS - 0.001);
    return {
      index: i,
      type: s.type,
      props: s.props ?? {},
      from,
      dur,
      startS,
      endS,
      cont: Boolean(s.continue),
      nextCont: Boolean(plan.scenes[i + 1]?.continue),
      words: mine.map((w) => ({ text: w.text, start: Math.round((w.start - startS) * fps), end: Math.round((w.end - startS) * fps) })),
    };
  });
};
