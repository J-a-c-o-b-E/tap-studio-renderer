import React from "react";
import { AbsoluteFill, continueRender, delayRender, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { siInstagram, siTelegram, siTiktok, siX, siYoutube } from "simple-icons";
import { ANTON, BLACK, clamp, CREAM, GREY, INTER, ORANGE, usePop, W } from "./engine";

/* Building blocks of the TAP poster look:
   cream dot-grid / orange / black backgrounds, Anton headlines, Inter Tight labels,
   white cards with a 3px black border and a 6px hard shadow, black pill tags, orange highlight blocks. */

// Fonts are local files (public/fonts) and are loaded before any frame renders.
if (typeof window !== "undefined" && typeof FontFace !== "undefined") {
  const load = (family: string, file: string, weight: string) => {
    const handle = delayRender(`font ${family}`);
    const f = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { weight });
    f.load()
      .then(() => {
        (document.fonts as any).add(f);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  };
  load(ANTON, "Anton-Regular.woff2", "400");
  load(INTER, "InterTight-ExtraBold.woff2", "100 900");
}

export type Bg = "cream" | "orange" | "black";
export const ink = (bg?: Bg) => (bg === "black" ? "#fff" : BLACK);
/** Anton headline style. */
export const A = (size: number, color: string = BLACK): React.CSSProperties => ({ fontFamily: ANTON, fontSize: size, lineHeight: 0.98, color, textTransform: "uppercase", letterSpacing: size > 100 ? 1 : 0.5 });
/** Inter Tight label style. */
export const I = (size: number, color: string = BLACK, weight = 800): React.CSSProperties => ({ fontFamily: INTER, fontWeight: weight, fontSize: size, lineHeight: 1.08, color, textTransform: "uppercase", letterSpacing: 0.5 });

export const COVERS = ["recipe", "travel", "apps", "gym", "study", "desk"];
const cover = (id: string) => (/^https?:\/\//.test(id) ? id : staticFile(`covers/${id}.jpg`));

/** Background: cream with a drifting dot grid, flat orange, or flat black. */
export const Background: React.FC<{ kind?: Bg }> = ({ kind = "cream" }) => {
  const frame = useCurrentFrame();
  if (kind === "orange") return <AbsoluteFill style={{ background: ORANGE }} />;
  if (kind === "black") return <AbsoluteFill style={{ background: BLACK }} />;
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(10,10,11,0.13) 3px, transparent 3.5px)", backgroundSize: "56px 56px", backgroundPosition: `${frame * 0.6}px ${frame * 0.4}px` }} />
    </AbsoluteFill>
  );
};

export const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; rot?: number; from?: number }> = ({ at, children, style, rot = 0, from = 0.9 }) => {
  const p = usePop(at, from);
  return <div style={{ transform: `scale(${p.scale.toFixed(3)}) rotate(${rot}deg)`, opacity: p.opacity, ...style }}>{children}</div>;
};

/** White card: 3px black border, 6px hard shadow. */
export const Card: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; bg?: string; edge?: string; r?: number }> = ({ style, children, bg = "#fff", edge = BLACK, r = 30 }) => (
  <div style={{ background: bg, border: `3px solid ${edge}`, borderRadius: r, boxShadow: `6px 6px 0 ${edge}`, boxSizing: "border-box", ...style }}>{children}</div>
);

/** Black pill tag. */
export const Tag: React.FC<{ children: React.ReactNode; size?: number; bg?: string; color?: string; style?: React.CSSProperties }> = ({ children, size = 44, bg = BLACK, color = "#fff", style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3, ...I(size, color), background: bg, borderRadius: 999, padding: `${size * 0.36}px ${size * 0.8}px`, border: `3px solid ${BLACK}`, whiteSpace: "nowrap", ...style }}>{children}</div>
);

/** Headline that slams in word by word. "*word*" gets the orange highlight block (black block on an orange background). */
export const Slam: React.FC<{ t: string; at: number; size: number; color?: string; bg?: Bg; style?: React.CSSProperties; gap?: number; wrap?: boolean }> = ({ t, at, size, color, bg, style, gap = 2, wrap = false }) => {
  const frame = useCurrentFrame();
  const toks: { w: string; acc: boolean }[] = [];
  t.split(/(\*[^*]+\*)/).filter(Boolean).forEach((seg) => {
    const acc = seg.startsWith("*");
    seg.replace(/\*/g, "").split(" ").filter(Boolean).forEach((w) => toks.push({ w, acc }));
  });
  return (
    <div style={{ ...A(size, color ?? ink(bg)), whiteSpace: wrap ? "normal" : "nowrap", ...style }}>
      {toks.map((k, i) => {
        const a = at + i * gap;
        const p = interpolate(frame, [a, a + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
        return (
          <span key={i} style={{ display: "inline-block", marginRight: i === toks.length - 1 ? 0 : "0.2em", transform: `scale(${1.5 - 0.5 * p}) rotate(${k.acc ? -1.5 : 0}deg)`, opacity: frame < a ? 0 : 1, ...(k.acc ? { background: bg === "orange" ? BLACK : ORANGE, color: bg === "orange" ? "#fff" : BLACK, padding: "0 0.12em", borderRadius: "0.08em" } : {}) }}>
            {k.w}
          </span>
        );
      })}
    </div>
  );
};

/** Diagonal orange tape ticker. */
export const Tape: React.FC<{ text: string; y?: number; rot?: number; bg?: string; color?: string; speed?: number }> = ({ text, y = 268, rot = -3, bg = ORANGE, color = BLACK, speed = 6 }) => {
  const frame = useCurrentFrame();
  const unit = `${text} ·  `;
  const w = unit.length * 23;
  const off = (((frame * speed) % w) + w) % w;
  return (
    <div style={{ position: "absolute", left: -200, top: y, width: W + 400, height: 76, background: bg, borderTop: `3px solid ${BLACK}`, borderBottom: `3px solid ${BLACK}`, transform: `rotate(${rot}deg)`, overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div style={{ ...I(38, color), letterSpacing: 2, whiteSpace: "pre", transform: `translateX(${-off}px)` }}>{unit.repeat(10)}</div>
    </div>
  );
};

/** Round tick or cross. */
export const Mark: React.FC<{ kind: "tick" | "cross"; size?: number; color?: string }> = ({ kind, size = 96, color }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: color ?? (kind === "tick" ? ORANGE : BLACK), border: `3px solid ${BLACK}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24">
      <path d={kind === "tick" ? "M4 12.5l5 5L20 6.5" : "M5 5l14 14M19 5L5 19"} fill="none" stroke={kind === "tick" ? BLACK : "#fff"} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

/** The real TAP mark (never distorted: the height always follows the width). */
export const TapMark: React.FC<{ w?: number }> = ({ w = 300 }) => <Img src={staticFile("brand/tap_mark.png")} style={{ width: w, height: w * (653 / 847) }} />;

/** The TAP mark on a black rounded tile. */
export const Logo: React.FC<{ size?: number }> = ({ size = 240 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.26, background: BLACK, border: `3px solid ${BLACK}`, boxShadow: `6px 6px 0 ${ORANGE}`, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
    <TapMark w={size * 0.66} />
  </div>
);

/** Simple phone frame. */
export const Phone: React.FC<{ w: number; h: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({ w, h, children, style }) => (
  <div style={{ width: w, height: h, borderRadius: w * 0.16, background: BLACK, padding: w * 0.035, boxSizing: "border-box", boxShadow: `6px 6px 0 ${BLACK}`, border: "3px solid #2a2a2e", ...style }}>
    <div style={{ width: "100%", height: "100%", borderRadius: w * 0.125, overflow: "hidden", position: "relative", background: "#fff" }}>{children}</div>
  </div>
);

/** A neutral slideshow cover: photo + white and orange text bars. `id` is a bundled cover name or an image URL. */
export const Cover: React.FC<{ id: string; dots?: number; cur?: number }> = ({ id, dots = 0, cur = 0 }) => (
  <div style={{ position: "absolute", inset: 0 }}>
    <Img src={cover(id)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
    <div style={{ position: "absolute", left: "12%", right: "12%", top: "40%", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div style={{ width: "100%", height: 22, borderRadius: 11, background: "#fff" }} />
      <div style={{ width: "66%", height: 22, borderRadius: 11, background: ORANGE }} />
    </div>
    {dots ? (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, display: "flex", justifyContent: "center", gap: 8 }}>
        {Array.from({ length: dots }, (_, i) => (
          <div key={i} style={{ width: i === cur ? 26 : 10, height: 10, borderRadius: 5, background: i === cur ? "#fff" : "rgba(255,255,255,0.55)" }} />
        ))}
      </div>
    ) : null}
  </div>
);

/** Outlined word that stamps in. */
export const Stamp: React.FC<{ at: number; text: string; size?: number; rot?: number; color?: string; bg?: string }> = ({ at, text, size = 170, rot = -6, color = ORANGE, bg = "transparent" }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  if (frame < at) return null;
  return (
    <div style={{ display: "inline-block", ...A(size, color), border: `10px solid ${color}`, borderRadius: 26, padding: "10px 34px 4px", background: bg, whiteSpace: "nowrap", transform: `scale(${2.2 - 1.2 * p}) rotate(${rot}deg)`, opacity: Math.min(1, p * 2) }}>{text}</div>
  );
};

export const DownArrow: React.FC<{ size?: number; color?: string }> = ({ size = 60, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 3v17M5 13l7 7 7-7" fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Anonymous avatar: a blank silhouette. */
export const Anon: React.FC<{ size?: number; color?: string; bg?: string }> = ({ size = 120, color = "#8a8a8f", bg = "#26262a" }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: bg, overflow: "hidden", position: "relative", flexShrink: 0 }}>
    <div style={{ position: "absolute", left: "32%", top: "20%", width: "36%", height: "36%", borderRadius: "50%", background: color }} />
    <div style={{ position: "absolute", left: "14%", top: "62%", width: "72%", height: "60%", borderRadius: "50%", background: color }} />
  </div>
);

/* ------------------------------------------------------------------ icons */

const PATHS: Record<string, React.ReactNode> = {
  check: <path d="M4 12.5l5 5L20 6.5" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 3l.6 1.6L7.2 5.2 5.6 5.8 5 7.4 4.4 5.8 2.8 5.2l1.6-.6z" />,
  play: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 9.5v5l4-2.5z" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3 7l9 6.5L21 7" />
    </>
  ),
  doc: (
    <>
      <path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21z" />
      <path d="M14 2.5v4h4M9 12h6M9 16h6" />
    </>
  ),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M17 14c2.8 0 4.5 2 4.5 5" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="8" cy="8" r="1.6" />
    </>
  ),
  app: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  store: (
    <>
      <path d="M3 9l1.5-5h15L21 9M4 9v11h16V9" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M2 9h20M12 9v12M12 9c-2-4-7-4-6 0M12 9c2-4 7-4 6 0" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5" />
    </>
  ),
  images: (
    <>
      <rect x="6" y="3" width="15" height="15" rx="2.5" />
      <path d="M3 8v11a2 2 0 0 0 2 2h11M6 14l4-4 4 4 3-3 4 4" />
    </>
  ),
  phone: <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a3 3 0 0 1-3 3A15 15 0 0 1 3 6a3 3 0 0 1 3-3z" />,
  heart: <path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" />,
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="11" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </>
  ),
};
export const ICON_NAMES = Object.keys(PATHS);

/** Line icon (24x24 stroke). */
export const Ico: React.FC<{ name: string; size?: number; color?: string; sw?: number }> = ({ name, size = 64, color = BLACK, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, overflow: "visible" }}>
    <g fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name] ?? PATHS.tag}
    </g>
  </svg>
);

// Real platform marks (simple-icons, CC0), in each platform's own colours.
const BRANDS: Record<string, { path: string; bg: string; fg: string }> = {
  telegram: { path: siTelegram.path, bg: "#26A5E4", fg: "#ffffff" },
  tiktok: { path: siTiktok.path, bg: "#000000", fg: "#ffffff" },
  instagram: { path: siInstagram.path, bg: "linear-gradient(45deg, #feda75, #fa7e1e 30%, #d62976 60%, #962fbf 85%, #4f5bd5)", fg: "#ffffff" },
  youtube: { path: siYoutube.path, bg: "#ffffff", fg: "#FF0000" },
  x: { path: siX.path, bg: "#000000", fg: "#ffffff" },
};
export const BRAND_NAMES = Object.keys(BRANDS);

/** App-icon style platform badge. */
export const BrandBadge: React.FC<{ name: string; size?: number; round?: boolean; style?: React.CSSProperties }> = ({ name, size = 72, round = false, style }) => {
  const b = BRANDS[name];
  if (!b) return null;
  const dark = b.bg === "#000000";
  return (
    <div style={{ width: size, height: size, borderRadius: round ? size / 2 : size * 0.24, background: b.bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${size * 0.08}px ${size * 0.25}px rgba(0,0,0,0.45)${dark ? ", inset 0 0 0 2px rgba(255,255,255,0.22)" : ""}`, flexShrink: 0, ...style }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path d={b.path} fill={b.fg} />
      </svg>
    </div>
  );
};

/** A platform badge (telegram, tiktok, ...) or a line icon. */
export const Glyph: React.FC<{ icon: string; size: number; color?: string }> = ({ icon, size, color = BLACK }) => (BRANDS[icon] ? <BrandBadge name={icon} size={size} round /> : <Ico name={icon} size={size} color={color} sw={2} />);

/** The course box: black box with the TAP mark, an orange title band and a small subtitle. */
export const ProductBox: React.FC<{ scale?: number; title?: string[]; subtitle?: string }> = ({ scale = 1, title = ["TAP AFFILIATE", "STARTER COURSE"], subtitle = "5 SHORT LESSONS" }) => (
  <div style={{ width: 560 * scale, height: 640 * scale, position: "relative" }}>
    <div style={{ position: "absolute", left: 500 * scale, top: 22 * scale, width: 60 * scale, height: 618 * scale, background: GREY, transform: "skewY(-20deg)", transformOrigin: "left top", borderRadius: `0 ${10 * scale}px ${10 * scale}px 0` }} />
    <div style={{ position: "absolute", left: 0, top: 0, width: 500 * scale, height: 640 * scale, background: BLACK, borderRadius: 14 * scale, border: `3px solid ${BLACK}`, boxSizing: "border-box", overflow: "hidden", boxShadow: `6px 6px 0 ${ORANGE}` }}>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 44 * scale }}>
        <TapMark w={150 * scale} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230 * scale, background: ORANGE, padding: `${22 * scale}px ${20 * scale}px ${14 * scale}px`, textAlign: "center", ...A(78 * scale) }}>
        {title.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 40 * scale, textAlign: "center", ...I(30 * scale, "#fff"), letterSpacing: 4 }}>{subtitle}</div>
    </div>
  </div>
);

/** Animated film grain (SVG turbulence, new seed every frame). */
export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
