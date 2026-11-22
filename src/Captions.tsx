import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BLACK, INTER, ORANGE } from "./engine";
import type { Placed, PlanWord } from "./plan";

type CapWord = { text: string; start: number; end: number }; // ms

/** Karaoke caption pill: 1-3 words at a time, uppercase Inter Tight 64 px, black on a white pill with a
    3px black border, the word being spoken in orange. Centred at y ~1340. Pages never cross a scene cut. */
export const Captions: React.FC<{ words: PlanWord[]; scenes: Placed[]; y?: number }> = ({ words, scenes, y = 1340 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pages = React.useMemo(() => {
    const out: CapWord[][] = [];
    for (const sc of scenes) {
      let cur: CapWord[] = [];
      for (const w of words) {
        if (!(w.start >= sc.startS - 0.001 && w.start < sc.endS - 0.001)) continue;
        const cw = { text: w.text, start: w.start * 1000, end: w.end * 1000 };
        const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
        const gap = cur.length ? cw.start - cur[cur.length - 1].end : 0;
        if (cur.length && (cur.length >= 3 || len > 17 || gap > 350)) {
          out.push(cur);
          cur = [];
        }
        cur.push(cw);
        if (/[.!?,]$/.test(w.text)) {
          out.push(cur);
          cur = [];
        }
      }
      if (cur.length) out.push(cur);
    }
    return out;
  }, [words, scenes]);
  const ms = (frame / fps) * 1000;
  let page: CapWord[] | undefined;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const next = pages[i + 1];
    const until = next ? Math.min(next[0].start, p[p.length - 1].end + 500) : p[p.length - 1].end + 500;
    if (ms >= p[0].start - 40 && ms < until) {
      page = p;
      break;
    }
  }
  if (!page) return null;
  const inF = (ms - page[0].start) / (1000 / fps);
  const pop = spring({ frame: Math.max(0, inF), fps, config: { damping: 15, stiffness: 260, mass: 0.5 } });
  return (
    <div style={{ position: "absolute", left: 64, right: 64, top: y, height: 0, display: "flex", justifyContent: "center", alignItems: "center", transform: `scale(${0.9 + 0.1 * pop})`, opacity: Math.min(1, pop * 3) }}>
      <div style={{ display: "flex", flexWrap: "nowrap", justifyContent: "center", gap: "0 18px", fontFamily: INTER, fontWeight: 800, fontSize: 64, lineHeight: 1, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap", background: "#fff", border: `3px solid ${BLACK}`, borderRadius: 999, padding: "20px 40px 18px", boxShadow: `6px 6px 0 ${BLACK}` }}>
        {page.map((w, i) => {
          const active = ms >= w.start - 30 && ms < (page![i + 1]?.start ?? w.end + 400) - 30;
          return (
            <span key={i} style={{ color: active ? ORANGE : BLACK }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
