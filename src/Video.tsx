import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "./Captions";
import { cueFrames } from "./engine";
import { Placed, placeScenes, Plan } from "./plan";
import { SCENES } from "./scenes";
import { FilmGrain } from "./ui";

/* The whole video: scenes cut on the plan's timings with whip / zoom / blur entries, a light camera punch on
   every cue, a white flash on cuts, film grain, the caption pill, the voiceover and (optionally) music. */

const EXIT = 4; // frames a scene keeps running under the next one
const TRANSITIONS = ["zoomIn", "whipUp", "zoomOut", "whipLeft", "blur", "whipDown", "whipRight"] as const;
const rgba = (a: number) => `rgba(247,161,46,${a})`;

const Shell: React.FC<{ p: Placed; isLast: boolean }> = ({ p, isLast }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const Comp = SCENES[p.type];
  const kind = TRANSITIONS[p.index % TRANSITIONS.length];
  const still = p.index === 0 || p.cont;
  const e = still ? 1 : spring({ frame, fps, config: { damping: 20, stiffness: 320, mass: 0.5 }, durationInFrames: 6 });
  const inv = 1 - e;
  let t = "";
  if (kind === "zoomIn") t = `scale(${0.72 + 0.28 * e})`;
  if (kind === "zoomOut") t = `scale(${1 + 0.45 * inv})`;
  if (kind === "whipLeft") t = `translateX(${inv * 800}px) skewX(${-inv * 10}deg)`;
  if (kind === "whipRight") t = `translateX(${-inv * 800}px) skewX(${inv * 10}deg)`;
  if (kind === "whipUp") t = `translateY(${inv * 1300}px)`;
  if (kind === "whipDown") t = `translateY(${-inv * 1300}px)`;
  if (kind === "blur") t = `scale(${1 + 0.12 * inv})`;
  const exitT = isLast || p.nextCont ? 0 : interpolate(frame, [p.dur, p.dur + EXIT], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blur = still ? exitT * 26 : inv * (kind === "blur" ? 40 : 22) + exitT * 26;
  const split = still ? 0 : Math.max(0, 1 - frame / 6) * 12;
  // Always keep an explicit filter value: removing it can leave Chrome's blurred layer cached between frames.
  const filter = `blur(${blur > 0.3 ? blur.toFixed(1) : 0}px) drop-shadow(${split.toFixed(1)}px 0 0 ${rgba(split > 0.3 ? 0.7 : 0)}) drop-shadow(${(-split).toFixed(1)}px 0 0 rgba(255,255,255,${split > 0.3 ? 0.5 : 0}))`;
  return (
    <AbsoluteFill style={{ transform: `${t} scale(${1 + exitT * 0.4})`, opacity: Math.min(1, e * 1.5) * (1 - exitT), filter }}>
      {Comp ? (
        <Comp scene={p} props={p.props} />
      ) : (
        <AbsoluteFill style={{ background: "#900", color: "white", fontSize: 60, alignItems: "center", justifyContent: "center" }}>Unknown scene: {p.type}</AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** Slow drift + a small punch-in with a light tilt on each cue. */
const Camera: React.FC<{ punches: number[]; children: React.ReactNode }> = ({ punches, children }) => {
  const frame = useCurrentFrame();
  let zoom = 0;
  let rot = 0;
  punches.forEach((p, i) => {
    const t = frame - p;
    if (t < 0 || t >= 24) return;
    const k = Math.exp(-t / 4.5);
    zoom += 0.04 * k;
    rot += (i % 2 ? 1 : -1) * 0.35 * k * Math.cos(t * 0.9);
  });
  return <AbsoluteFill style={{ transform: `translate(${Math.sin(frame / 41) * 4}px, ${Math.cos(frame / 47) * 5}px) rotate(${rot.toFixed(3)}deg) scale(${1.012 + Math.min(0.09, zoom)})` }}>{children}</AbsoluteFill>;
};

const Flash: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t >= 4) return null;
  return <AbsoluteFill style={{ background: "white", mixBlendMode: "screen", opacity: 0.22 * (1 - t / 4) }} />;
};

/** The cues that drive the camera: `cue`, `cues` and the `cue` of each entry in `lines`. */
const cuesOf = (props: Record<string, any>): (string | number)[] =>
  [props.cue, ...(Array.isArray(props.cues) ? props.cues : []), ...(Array.isArray(props.lines) ? props.lines.map((l: any) => l?.cue) : [])].filter((c) => typeof c === "string" || typeof c === "number");

const src = (u: string) => (/^(https?:|data:|blob:)/.test(u) ? u : staticFile(u.replace(/^\//, "")));

export const TapVideo: React.FC<{ plan: Plan }> = ({ plan }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const placed = React.useMemo(() => placeScenes(plan, fps), [plan, fps]);
  const punches: number[] = [];
  for (const p of placed) {
    const at = cueFrames(p.words, cuesOf(p.props), fps, p.dur).map((f) => p.from + f);
    for (const f of at.sort((a, b) => a - b)) if (!punches.length || f - punches[punches.length - 1] > 7) punches.push(f);
  }
  const cuts = placed.slice(1).filter((p) => !p.cont).map((p) => p.from);
  const music = plan.music && plan.music.url ? plan.music : null;
  const musicVol = music?.volume ?? 0.023;
  const fadeOutStart = durationInFrames - fps * 2;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Camera punches={punches}>
        {placed.map((p, i) => {
          const isLast = i === placed.length - 1;
          return (
            <Sequence key={i} from={p.from} durationInFrames={isLast ? Math.max(1, durationInFrames - p.from) : p.dur + (p.nextCont ? 0 : EXIT)} name={`${i} ${p.type}`}>
              <Shell p={p} isLast={isLast} />
            </Sequence>
          );
        })}
      </Camera>
      {cuts.map((c, i) => (
        <Flash key={i} at={c} />
      ))}
      <FilmGrain opacity={0.05} />
      {plan.captions?.enabled === false ? null : <Captions words={plan.words ?? []} scenes={placed} y={plan.captions?.y} />}
      {plan.voiceover_url ? <Audio src={src(plan.voiceover_url)} /> : null}
      {music ? (
        <Audio src={src(music.url!)} loop trimBefore={Math.round((music.start ?? 0) * fps)} volume={(f) => musicVol * interpolate(f, [0, 3, fadeOutStart, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      ) : null}
    </AbsoluteFill>
  );
};

