import React from "react";
import { AbsoluteFill, Easing, interpolate, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BLACK, clamp, ORANGE, popAt, prog, RED, SceneProps, spr, SW, tx, useCues, usePop, W, X0 } from "./engine";
import { A, Anon, Background, Bg, BrandBadge, Card, Cover, COVERS, DownArrow, Glyph, I, Ico, ink, Logo, Mark, Phone, Pop, ProductBox, Slam, Stamp, Tag, Tape } from "./ui";

/* Every scene type of the plan. Each scene reads its `props` and the words spoken during it (for cues).
   Layout rule: everything important sits inside x 64-1016, y 250-1260; the caption pill sits below at y ~1340.
   To add a scene type: write a component here, add it to SCENES at the bottom, and describe it in schema/scenes.mjs. */

type Item = { text?: string; t?: string; cue?: string | number };

/* ------------------------------------------------------------------ pills: tick / cross pills (0 FOLLOWERS / NO PRODUCT / NO FACE) */

const Pills: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const items: Item[] = props.items;
  const at = useCues(scene, items.map((i) => i.cue));
  at[0] = Math.min(at[0], 2); // no dead air: the first pill is there from the first frames
  const [footAt] = useCues(scene, [props.foot?.cue]);
  const top = props.tape ? 420 : 330;
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      {props.tape ? <Tape text={props.tape} /> : null}
      {items.map((it, i) => {
        const flipped = !props.flip || frame >= at[i] + 9;
        const p = interpolate(frame, [at[i] + 9, at[i] + 13], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.5)) });
        return (
          <div key={i} style={{ position: "absolute", left: X0, top: top + i * 215, width: SW, display: "flex", justifyContent: i % 2 ? "flex-end" : "flex-start" }}>
            <Pop at={at[i]} rot={i % 2 ? 2 : -2}>
              <div style={{ display: "flex", alignItems: "center", gap: 28, background: BLACK, borderRadius: 999, padding: "22px 54px 22px 24px", border: `3px solid ${BLACK}`, boxShadow: `6px 6px 0 ${ORANGE}` }}>
                <div style={{ transform: `scale(${props.flip ? (flipped ? 0.6 + 0.4 * p : 1) : 1})` }}>
                  <Mark kind={flipped ? "tick" : "cross"} size={120} color={flipped ? ORANGE : RED} />
                </div>
                <div style={{ ...A(124, "#fff"), whiteSpace: "nowrap" }}>{tx(it)}</div>
              </div>
            </Pop>
          </div>
        );
      })}
      {props.foot ? (
        <div style={{ position: "absolute", left: X0, top: top + 3 * 215 + 20, width: SW, textAlign: "center" }}>
          <Slam t={`*${tx(props.foot)}*`} at={footAt} size={120} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ phones: three phones fanning out + a bouncing tag */

const Phones: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = useCues(scene, props.cues ?? []);
  const [linkAt] = useCues(scene, [props.linkCue]);
  const names: string[] = props.platforms ?? ["tiktok", "instagram", "youtube"];
  const covers: string[] = props.covers ?? COVERS;
  const fan = spr(frame, fps, 3, { damping: 13, stiffness: 150 });
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      <div style={{ position: "absolute", left: X0, top: 262, width: SW, textAlign: "center" }}>
        <Slam t={props.head} at={1} size={132} bg={props.bg} />
      </div>
      {[0, 1, 2].map((i) => {
        const icon = popAt(frame, at[i] ?? 0);
        return (
          <div key={i} style={{ position: "absolute", left: W / 2 - 135 + (i - 1) * 300 * fan, top: 600 + (i === 1 ? -20 : 14 * fan), transform: `rotate(${(i - 1) * 7 * fan}deg)`, zIndex: i === 1 ? 2 : 1 }}>
            <Phone w={270} h={500}>
              <Cover id={covers[i % covers.length]} dots={5} cur={(Math.floor(frame / 14) + i) % 5} />
            </Phone>
            <div style={{ position: "absolute", left: 95, top: -62, transform: `scale(${icon.scale})`, opacity: icon.opacity }}>
              <BrandBadge name={names[i]} size={84} style={{ border: `3px solid ${BLACK}` }} />
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: X0, top: 1130, width: SW, display: "flex", justifyContent: "center", transform: `translateY(${frame >= linkAt ? -Math.abs(Math.sin((frame - linkAt) / 4)) * 16 : 0}px)` }}>
        <Pop at={linkAt} rot={-2}>
          <Tag size={58}>{props.tag ?? "LINK IN BIO"}</Tag>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ headline: big statement, last line in the orange highlight box */

const Headline: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg: Bg = props.bg ?? "cream";
  const lines: Item[] = props.lines;
  const at = useCues(scene, lines.map((l) => l.cue));
  at[0] = Math.min(at[0], 3);
  const [flipAt] = useCues(scene, [props.flipCue]);
  const hasStack = props.flipCue != null;
  const flip = hasStack ? spr(frame, fps, flipAt, { damping: 12, stiffness: 120 }) : 0;
  const blocks: string[] = props.blocks ?? ["ADS", "PRODUCT", "STORE"];
  const size = (t: string) => Math.min(360, Math.floor(SW / (t.length * 0.54)));
  return (
    <AbsoluteFill>
      <Background kind={bg} />
      {hasStack ? (
        <div style={{ position: "absolute", left: W / 2 - 170, top: 280, width: 340, transform: `rotate(${flip * 180}deg)` }}>
          {blocks.map((b, i) => (
            <Card key={b} style={{ height: 92, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", ...A(60), transform: `rotate(${(i - 1) * 2}deg)` }}>{b}</Card>
          ))}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: X0, top: hasStack ? 660 : 250, width: SW, height: hasStack ? 600 : 1010, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
        {lines.map((l, i) => {
          const t = tx(l);
          return <Slam key={i} t={i === lines.length - 1 && bg !== "orange" ? `*${t}*` : t} at={at[i]} size={size(t)} color={bg === "orange" ? (i % 2 ? "#fff" : BLACK) : undefined} bg={bg} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ icon_flow: icon row -> arrow -> action pills -> arrow -> stamped word */

const IconFlow: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const sources: (Item & { icon: string })[] = props.sources ?? [];
  const actions: Item[] = props.actions;
  const sAt = useCues(scene, sources.map((s) => s.cue));
  const aAt = useCues(scene, actions.map((a) => a.cue));
  const [stampAt] = useCues(scene, [props.stampCue]);
  if (sources.length) sAt[0] = Math.min(sAt[0], 2);
  else aAt[0] = Math.min(aAt[0], 6);
  const has = sources.length > 0;
  const ay = has ? 640 : 420;
  return (
    <AbsoluteFill>
      <Background kind="black" />
      {!has ? (
        <div style={{ position: "absolute", left: X0, top: 270, width: SW, textAlign: "center" }}>
          <Slam t={props.head ?? "THROUGH *YOUR LINK*"} at={1} size={110} color="#fff" bg="black" />
        </div>
      ) : null}
      {sources.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: X0 + i * 322, top: 280, width: 308 }}>
          <Pop at={sAt[i]} rot={(i - 1) * 2.5}>
            <Card edge="#fff" style={{ height: 250, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 10px", textAlign: "center" }}>
              <Glyph icon={s.icon} size={96} />
              <div style={I(tx(s).length > 8 ? 30 : 44)}>{tx(s)}</div>
            </Card>
          </Pop>
        </div>
      ))}
      {has ? (
        <div style={{ position: "absolute", left: W / 2 - 34, top: 548, opacity: prog(frame, aAt[0] - 4, 4) }}>
          <DownArrow size={68} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: X0, top: ay, width: SW, display: "flex", justifyContent: "center", alignItems: "center", gap: 18 }}>
        {actions.map((a, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <div style={{ ...A(70, "#fff"), opacity: frame >= aAt[i] ? 1 : 0 }}>·</div> : null}
            <Pop at={aAt[i]} rot={(i - 1) * -2}>
              <Tag size={has ? 52 : 62} bg={ORANGE} color={BLACK}>
                {tx(a)}
              </Tag>
            </Pop>
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: "absolute", left: W / 2 - 34, top: ay + 130, opacity: frame >= stampAt ? 1 : 0.25 }}>
        <DownArrow size={68} />
      </div>
      <div style={{ position: "absolute", left: X0, top: ay + 250, width: SW, display: "flex", justifyContent: "center" }}>
        <Stamp at={stampAt} text={props.stamp ?? "COMMISSION"} size={has ? 170 : 190} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ checklist: one card, ticks (highlighted) and crosses (struck through) */

const Checklist: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const items: (Item & { kind?: "tick" | "cross" })[] = props.items;
  const at = useCues(scene, items.map((i) => i.cue));
  at[0] = Math.min(at[0], 6);
  const card = usePop(1);
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      <div style={{ position: "absolute", left: X0, top: 330, width: SW, transform: `scale(${card.scale}) rotate(-1.5deg)`, opacity: card.opacity }}>
        <Card style={{ padding: "50px 44px", display: "flex", flexDirection: "column", gap: 44 }}>
          {items.map((it, i) => {
            const kind = it.kind ?? "tick";
            const st = prog(frame, at[i] + 5, 6);
            return (
              <Pop key={i} at={at[i]} style={{ display: "flex", alignItems: "center", gap: 34 }}>
                <Mark kind={kind} size={130} />
                <div style={{ position: "relative", whiteSpace: "nowrap", ...A(92, kind === "cross" ? "#8a8a8a" : BLACK) }}>
                  {kind === "tick" ? <span style={{ background: ORANGE, padding: "0 0.12em", borderRadius: "0.08em" }}>{tx(it)}</span> : tx(it)}
                  {kind === "cross" ? <div style={{ position: "absolute", left: -6, top: "46%", height: 12, width: `${st * 103}%`, background: BLACK, borderRadius: 6 }} /> : null}
                </div>
              </Pop>
            );
          })}
        </Card>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ product_box: the course box, optionally with lesson cards or a footer line */

const ProductBoxScene: React.FC<SceneProps> = ({ scene, props }) => {
  const [boxAt] = useCues(scene, [props.cue]);
  const lessons: Item[] = props.lessons ?? [];
  const lAt = useCues(scene, lessons.map((l) => l.cue));
  const [footAt] = useCues(scene, [props.foot?.cue]);
  const at = Math.min(boxAt, 4);
  const sc = lessons.length ? 0.66 : 1;
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      <div style={{ position: "absolute", left: X0, top: lessons.length ? 270 : 290, width: SW, display: "flex", justifyContent: "center" }}>
        <Pop at={at} rot={-3} from={0.6}>
          <ProductBox scale={sc} title={props.title} subtitle={props.subtitle} />
        </Pop>
      </div>
      {lessons.map((l, i) => (
        <div key={i} style={{ position: "absolute", left: X0, top: 730 + i * 178, width: SW }}>
          <Pop at={lAt[i]} rot={i % 2 ? 1.5 : -1.5}>
            <Card style={{ height: 156, display: "flex", alignItems: "center", gap: 30, padding: "0 30px" }}>
              <Mark kind="tick" size={96} />
              <div style={{ ...A(84), whiteSpace: "nowrap" }}>{tx(l)}</div>
            </Card>
          </Pop>
        </div>
      ))}
      {props.foot ? (
        <div style={{ position: "absolute", left: X0, top: 1010, width: SW, textAlign: "center" }}>
          <Slam t={tx(props.foot)} at={footAt} size={92} bg={props.bg} wrap />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ steps: numbered cards */

const Steps: React.FC<SceneProps> = ({ scene, props }) => {
  const items: Item[] = props.items;
  const at = useCues(scene, items.map((i) => i.cue));
  at[0] = Math.min(at[0], 2);
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      {items.map((it, i) => (
        <div key={i} style={{ position: "absolute", left: X0, top: 280 + i * 245, width: SW }}>
          <Pop at={at[i]} rot={i % 2 ? 1.5 : -1.5}>
            <Card style={{ height: 214, display: "flex", alignItems: "center", gap: 34, padding: "0 30px" }}>
              <div style={{ width: 154, height: 154, borderRadius: 28, background: ORANGE, border: `3px solid ${BLACK}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...A(130) }}>{i + 1}</div>
              <div style={A(tx(it).length > 16 ? 76 : 96)}>{tx(it)}</div>
            </Card>
          </Pop>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ big_number: "5 SHORT LESSONS" + the 1-on-1 card */

const BigNumber: React.FC<SceneProps> = ({ scene, props }) => {
  const bg: Bg = props.bg ?? "cream";
  const [five, one] = useCues(scene, props.cues ?? []);
  const a = Math.min(five, 2);
  const lines: string[] = props.lines ?? ["SHORT", "LESSONS"];
  const card = props.card === null ? null : { title: "1-ON-1", prefix: "WITH", name: "JAMES", icon: "telegram", ...(props.card ?? {}) };
  return (
    <AbsoluteFill>
      <Background kind={bg} />
      <div style={{ position: "absolute", left: X0, top: 262, width: SW, display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <Pop at={a} rot={-4} from={0.5}>
          <div style={{ width: 330, height: 420, borderRadius: 40, background: ORANGE, border: `3px solid ${BLACK}`, boxShadow: `6px 6px 0 ${bg === "black" ? "#fff" : BLACK}`, display: "flex", alignItems: "center", justifyContent: "center", ...A(400) }}>{props.number ?? "5"}</div>
        </Pop>
        <div>
          {lines.map((l, i) => (
            <Slam key={i} t={l} at={a + 3 + i * 3} size={190} color={ink(bg)} />
          ))}
        </div>
      </div>
      {card ? (
        <div style={{ position: "absolute", left: X0, top: 800, width: SW }}>
          <Pop at={one} rot={1.5}>
            <Card edge={bg === "black" ? "#fff" : BLACK} style={{ height: 380, display: "flex", alignItems: "center", gap: 44, padding: "0 50px" }}>
              <Glyph icon={card.icon} size={210} />
              <div>
                <div style={A(220)}>{card.title}</div>
                <div style={{ ...I(60), marginTop: 6 }}>
                  {card.prefix} <span style={{ background: ORANGE, padding: "0 0.14em", borderRadius: 8 }}>{card.name}</span>
                </div>
              </div>
            </Card>
          </Pop>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ price_tag: a hanging price tag that drops in and swings (orange) */

const PriceTag: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [five] = useCues(scene, [props.cue]);
  const at = Math.min(five, 6);
  const drop = spr(frame, fps, at, { damping: 10, stiffness: 170 });
  const swing = Math.sin((frame - at) / 5) * 10 * Math.exp(-Math.max(0, frame - at) / 28);
  const price: string = props.price ?? "$5";
  const sym = /^\D/.test(price) ? price[0] : "";
  return (
    <AbsoluteFill>
      <Background kind="orange" />
      <div style={{ position: "absolute", left: X0, top: 258, width: SW, textAlign: "center" }}>
        <Slam t={props.head} at={0} size={200} color="#fff" />
      </div>
      <div style={{ position: "absolute", left: W / 2 - 3, top: 470, width: 6, height: 150 * drop, background: BLACK }} />
      <div style={{ position: "absolute", left: W / 2 - 330, top: 590, width: 660, transformOrigin: "50% -8%", transform: `translateY(${(1 - drop) * -1200}px) rotate(${swing + 3}deg)` }}>
        <Card r={56} style={{ height: 650, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: 30, width: 56, height: 56, borderRadius: "50%", background: ORANGE, border: `3px solid ${BLACK}`, boxSizing: "border-box" }} />
          <div style={{ ...A(price.length > 2 ? Math.floor(1040 / price.length) : 520), marginTop: 50, letterSpacing: -6 }}>
            {sym ? <span style={{ color: ORANGE, WebkitTextStroke: `4px ${BLACK}` }}>{sym}</span> : null}
            {price.slice(sym.length)}
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ launch_grid: launch price headline + a 10x10 grid of member slots */

const LaunchGrid: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const [launch, hundred] = useCues(scene, props.cues ?? []);
  const a = Math.min(launch, 3);
  const filled = new Set<number>(props.filled ?? [2, 5, 11, 17, 23, 30, 38, 41, 52]);
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      <div style={{ position: "absolute", left: X0, top: 262, width: SW, textAlign: "center" }}>
        <Slam t={props.head ?? "*LAUNCH PRICE*"} at={a} size={150} bg={props.bg} />
      </div>
      <div style={{ position: "absolute", left: X0, top: 440, width: SW, display: "flex", justifyContent: "center" }}>
        <Pop at={hundred - 6} rot={-2}>
          <Tag size={56}>{props.tag ?? "FIRST 100 MEMBERS"}</Tag>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: W / 2 - 345, top: 590, width: 690, display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 10 }}>
        {Array.from({ length: 100 }, (_, i) => {
          const at = a + 4 + i * 0.28;
          const p = interpolate(frame, [at, at + 4], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
          return <div key={i} style={{ height: 58, borderRadius: 12, border: `3px solid ${BLACK}`, background: filled.has(i) ? ORANGE : "#fff", boxSizing: "border-box", transform: `scale(${p})` }} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ clock: a ticking clock + two lines (black) */

const Clock: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const [still] = useCues(scene, [props.cue]);
  const a = Math.min(still, 8);
  const lines: string[] = props.lines ?? ["THERE'S STILL", "*TIME*"];
  return (
    <AbsoluteFill>
      <Background kind="black" />
      <div style={{ position: "absolute", left: W / 2 - 210, top: 270 }}>
        <Pop at={1} from={0.5}>
          <svg width={420} height={420} viewBox="0 0 200 200">
            <circle cx={100} cy={100} r={92} fill="#fff" stroke={ORANGE} strokeWidth={12} />
            {Array.from({ length: 12 }, (_, i) => {
              const ang = (i / 12) * Math.PI * 2;
              return <line key={i} x1={100 + Math.cos(ang) * 74} y1={100 + Math.sin(ang) * 74} x2={100 + Math.cos(ang) * 64} y2={100 + Math.sin(ang) * 64} stroke={BLACK} strokeWidth={5} strokeLinecap="round" />;
            })}
            <line x1={100} y1={100} x2={100} y2={56} stroke={BLACK} strokeWidth={9} strokeLinecap="round" transform={`rotate(${40 + frame * 1.2} 100 100)`} />
            <line x1={100} y1={100} x2={100} y2={38} stroke={BLACK} strokeWidth={6} strokeLinecap="round" transform={`rotate(${frame * 12} 100 100)`} />
            <circle cx={100} cy={100} r={8} fill={ORANGE} stroke={BLACK} strokeWidth={3} />
          </svg>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0, top: 740, width: SW, textAlign: "center" }}>
        <Slam t={lines[0]} at={a - 4} size={170} color="#fff" bg="black" />
        <Slam t={lines[1] ?? ""} at={a + 3} size={330} bg="black" style={{ marginTop: 6 }} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ cta: the end card (logo, two lines, button with the price, bouncing arrows) */

const Cta: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const [click] = useCues(scene, [props.cue]);
  const a = Math.min(click, 14);
  const lines: string[] = props.lines ?? ["LEARN *AFFILIATE*", "MARKETING"];
  const price: string | null = props.price === null ? null : (props.price ?? "$5");
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      <div style={{ position: "absolute", left: X0, top: 280, width: SW, display: "flex", justifyContent: "center" }}>
        <Pop at={0} from={0.5}>
          <Logo size={250} />
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0, top: 570, width: SW, textAlign: "center" }}>
        <Slam t={lines[0]} at={3} size={128} bg={props.bg} />
        <Slam t={lines[1] ?? ""} at={8} size={200} bg={props.bg} style={{ marginTop: 10 }} />
      </div>
      <div style={{ position: "absolute", left: X0 + 46, top: 940, width: SW - 92 }}>
        <Pop at={a} rot={-1.5}>
          <div style={{ height: 170, borderRadius: 44, background: BLACK, border: `3px solid ${BLACK}`, boxShadow: `6px 6px 0 ${ORANGE}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 26, transform: `scale(${1 + Math.sin(frame / 5) * 0.012})` }}>
            <div style={{ ...A(104, "#fff"), whiteSpace: "nowrap" }}>{props.button ?? "GET STARTED –"}</div>
            {price ? <div style={{ ...A(104), background: ORANGE, borderRadius: 22, padding: "6px 26px 0" }}>{price}</div> : null}
          </div>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0, top: 1160, width: SW, display: "flex", justifyContent: "center", gap: 46, opacity: frame >= a + 4 ? 1 : 0 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ transform: `translateY(${Math.abs(Math.sin((frame + i * 5) / 6)) * 14}px)` }}>
            <DownArrow size={70} color={ORANGE} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ strike_list: cards that get struck through, then a footer line */

const StrikeList: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const items: Item[] = props.items;
  const at = useCues(scene, items.map((i) => i.cue));
  at[0] = Math.min(at[0], 2);
  const [crossAt] = useCues(scene, [props.crossCue]);
  const [footAt] = useCues(scene, [props.foot?.cue]);
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      {props.tape ? <Tape text={props.tape} /> : null}
      {items.map((it, i) => {
        const st = prog(frame, crossAt + i * 3, 5);
        return (
          <div key={i} style={{ position: "absolute", left: X0, top: 410 + i * 215, width: SW }}>
            <Pop at={at[i]} rot={i % 2 ? 1.8 : -1.8}>
              <Card style={{ height: 184, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: st > 0.5 ? "#e6e1d8" : "#fff" }}>
                <div style={{ ...A(tx(it).length > 12 ? 112 : 132, st > 0.5 ? "#8a8a8a" : BLACK), whiteSpace: "nowrap" }}>{tx(it)}</div>
                <div style={{ position: "absolute", left: 50, top: 84, height: 16, width: (SW - 106) * st, background: RED, borderRadius: 8, transform: "rotate(-2deg)" }} />
              </Card>
            </Pop>
          </div>
        );
      })}
      {props.foot ? (
        <div style={{ position: "absolute", left: X0, top: 1080, width: SW, textAlign: "center" }}>
          <Slam t={`*${tx(props.foot)}*`} at={footAt} size={124} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ block_stack: blocks stack up under a headline, then fall over (black) */

const BlockStack: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const blocks: Item[] = props.blocks;
  const at = useCues(scene, blocks.map((b) => b.cue));
  const [headAt] = useCues(scene, [props.headCue]);
  const [fallAt] = useCues(scene, [props.fallCue]);
  const f = Math.max(0, frame - fallAt);
  const wob = frame >= fallAt - 10 && frame < fallAt ? Math.sin(frame * 1.6) * 3 : 0;
  return (
    <AbsoluteFill>
      <Background kind="black" />
      {props.kicker ? (
        <div style={{ position: "absolute", left: X0, top: 268, width: SW, display: "flex", justifyContent: "center" }}>
          <Pop at={1} rot={-2}>
            <Tag size={44} bg="#fff" color={BLACK}>
              {props.kicker}
            </Tag>
          </Pop>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: X0, top: 400, width: SW, textAlign: "center" }}>
        <Slam t={props.head} at={headAt} size={250} color="#fff" bg="black" wrap />
      </div>
      {blocks.map((b, i) => {
        const p = interpolate(frame, [at[i], at[i] + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
        const dir = i === 1 ? 1 : -1;
        const fall = frame >= fallAt ? { x: dir * f * (10 + i * 5), y: f * f * 0.9, r: dir * f * (3 + i * 2) } : { x: 0, y: 0, r: 0 };
        return (
          <div key={i} style={{ position: "absolute", left: W / 2 - 280 + (i - 1) * 14, top: 1090 - i * 158 + (1 - p) * -700 + fall.y, width: 560, transform: `translateX(${fall.x}px) rotate(${wob * (i + 1) * 0.6 + fall.r + (i - 1) * 1.5}deg)`, opacity: frame < at[i] ? 0 : 1 }}>
            <Card edge="#fff" bg={i === blocks.length - 1 ? ORANGE : "#fff"} style={{ height: 146, display: "flex", alignItems: "center", justifyContent: "center", ...A(104) }}>{tx(b)}</Card>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ have_need: icon row, then "THEY HAVE ..." and "THEY NEED ..." cards */

const HaveNeed: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const [a, b, c, have, need] = useCues(scene, props.cues ?? []);
  const src: { icon: string; text: string }[] = props.icons ?? [
    { icon: "app", text: "APPS" },
    { icon: "telegram", text: "TELEGRAM" },
    { icon: "store", text: "BRANDS" },
  ];
  const ats = [Math.min(a, 2), b, c];
  const h = { label: "THEY HAVE", text: "THE PRODUCT", ...(props.have ?? {}) };
  const n = { label: "THEY NEED", text: "CUSTOMERS", ...(props.need ?? {}) };
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      {src.slice(0, 3).map((ic, i) => (
        <div key={i} style={{ position: "absolute", left: X0 + i * 322, top: 270, width: 308 }}>
          <Pop at={ats[i]} rot={(i - 1) * 2.5}>
            <Card style={{ height: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <Glyph icon={ic.icon} size={100} />
              <div style={I(38)}>{tx(ic)}</div>
            </Card>
          </Pop>
        </div>
      ))}
      <div style={{ position: "absolute", left: X0, top: 580, width: SW }}>
        <Pop at={have - 3} rot={-1.5}>
          <Card bg={BLACK} style={{ padding: "34px 30px 26px", textAlign: "center" }}>
            <div style={I(44, "#fff")}>{h.label}</div>
            <div style={{ ...A(150, ORANGE), marginTop: 6, whiteSpace: "nowrap" }}>{h.text}</div>
          </Card>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0, top: 890, width: SW }}>
        <Pop at={need - 3} rot={1.5}>
          <Card bg={ORANGE} style={{ padding: "34px 30px 30px", textAlign: "center" }}>
            <div style={I(44)}>{n.label}</div>
            <div style={{ ...A(150), marginTop: 6, whiteSpace: "nowrap" }}>{n.text}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 14 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ transform: `scale(${interpolate(frame, [need + 4 + i * 2, need + 8 + i * 2], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })})` }}>
                  <Anon size={62} color="#fff" bg={BLACK} />
                </div>
              ))}
            </div>
          </Card>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ walk: people walk from a phone to a brand card, then a stamped word (black) */

const Walk: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const [com, every] = useCues(scene, props.cues ?? []);
  return (
    <AbsoluteFill>
      <Background kind="black" />
      <div style={{ position: "absolute", left: X0, top: 268, width: SW, display: "flex", justifyContent: "center" }}>
        <Pop at={every - 4} rot={-2}>
          <Tag size={46} bg={ORANGE} color={BLACK}>
            {props.tag ?? "FOR EVERY PERSON YOU SEND"}
          </Tag>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0 + 10, top: 410 }}>
        <Pop at={1} rot={-4}>
          <Phone w={250} h={470}>
            <Cover id={props.cover ?? "travel"} dots={5} cur={Math.floor(frame / 12) % 5} />
          </Phone>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0 + SW - 300, top: 470 }}>
        <Pop at={4} rot={3}>
          <Card edge="#fff" style={{ width: 300, height: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <Ico name={props.icon ?? "store"} size={150} color={BLACK} sw={2} />
            <div style={A(84)}>{props.label ?? "BRAND"}</div>
          </Card>
        </Pop>
      </div>
      {[0, 1, 2, 3].map((i) => {
        const t = ((frame * 1.3 + i * 13) % 52) / 52;
        return (
          <div key={i} style={{ position: "absolute", left: X0 + 280 + t * 330, top: 610 + Math.abs(Math.sin(t * Math.PI * 4)) * -18, opacity: Math.min(1, t * 6, (1 - t) * 6) }}>
            <Anon size={74} color={BLACK} bg={ORANGE} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: X0, top: 930, width: SW, display: "flex", justifyContent: "center" }}>
        <Stamp at={com} text={props.stamp ?? "COMMISSION"} size={180} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ swipe_phone: one phone swiping through a slideshow (orange) */

const SwipePhone: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const [slides, offer] = useCues(scene, props.cues ?? []);
  const covers: string[] = props.covers ?? COVERS;
  const n = covers.length;
  const per = 12;
  const idx = Math.floor(frame / per);
  const sw = interpolate(frame % per, [per - 5, per], [0, 1], { ...clamp, easing: (t) => t * t * (3 - 2 * t) });
  return (
    <AbsoluteFill>
      <Background kind="orange" />
      <div style={{ position: "absolute", left: W / 2 - 230, top: 262 }}>
        <Pop at={0} rot={-2} from={0.6}>
          <Phone w={460} h={860}>
            <div style={{ position: "absolute", inset: 0, transform: `translateX(${-sw * 100}%)` }}>
              <Cover id={covers[idx % n]} />
            </div>
            <div style={{ position: "absolute", inset: 0, transform: `translateX(${(1 - sw) * 100}%)` }}>
              <Cover id={covers[(idx + 1) % n]} />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, display: "flex", justifyContent: "center", gap: 10 }}>
              {Array.from({ length: n }, (_, i) => (
                <div key={i} style={{ width: i === idx % n ? 34 : 14, height: 14, borderRadius: 7, background: i === idx % n ? "#fff" : "rgba(255,255,255,0.55)" }} />
              ))}
            </div>
          </Phone>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0, top: 330, width: SW }}>
        <Pop at={Math.min(slides, 8)} rot={-5}>
          <Tag size={46} bg="#fff" color={BLACK}>
            {props.tag ?? "SIMPLE SLIDESHOWS"}
          </Tag>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0, top: 1010, width: SW, display: "flex", justifyContent: "flex-end", transform: `translateY(${frame >= offer ? -Math.abs(Math.sin((frame - offer) / 4)) * 14 : 0}px)` }}>
        <Pop at={offer} rot={4}>
          <Tag size={58}>{props.linkTag ?? "LINK IN BIO"}</Tag>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ logo_stats: TAP logo + two static stat cards (optionally swapping the logo for the course box) */

const LogoStats: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const bg: Bg = props.bg ?? "cream";
  const [tap, s1, s2] = useCues(scene, props.cues ?? []);
  const [boxAt] = useCues(scene, [props.boxCue]);
  const showBox = props.boxCue != null && frame >= boxAt;
  const t = Math.min(tap, 6);
  const stats: { value: string; label: string }[] = props.stats ?? [
    { value: "240+", label: "AFFILIATES" },
    { value: "110+", label: "OFFERS" },
  ];
  const stat = (at: number, v: string, l: string, fill: string, color: string, rot: number, x: number) => (
    <div style={{ position: "absolute", left: x, top: showBox ? 1010 : 760, width: 462 }}>
      <Pop at={at} rot={rot}>
        <Card bg={fill} edge={bg === "black" ? "#fff" : BLACK} style={{ height: showBox ? 230 : 440, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={A(showBox ? 130 : 250, color)}>{v}</div>
          <div style={{ ...I(showBox ? 34 : 52, color), marginTop: 4 }}>{l}</div>
        </Card>
      </Pop>
    </div>
  );
  return (
    <AbsoluteFill>
      <Background kind={bg} />
      {showBox ? (
        <div style={{ position: "absolute", left: X0, top: 270, width: SW, display: "flex", justifyContent: "center" }}>
          <Pop at={boxAt} rot={-3} from={0.6}>
            <ProductBox scale={1.08} title={props.boxTitle} subtitle={props.boxSubtitle} />
          </Pop>
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", left: X0, top: 270, width: SW, display: "flex", justifyContent: "center" }}>
            <Pop at={t} from={0.5}>
              <Logo size={270} />
            </Pop>
          </div>
          <div style={{ position: "absolute", left: X0, top: 580, width: SW, textAlign: "center" }}>
            <Slam t={props.head ?? "AN AFFILIATE *NETWORK*"} at={t + 5} size={104} color={ink(bg)} bg={bg} />
          </div>
        </>
      )}
      {stat(s1, stats[0].value, stats[0].label, bg === "black" ? "#fff" : BLACK, bg === "black" ? BLACK : "#fff", -2, X0)}
      {stats[1] ? stat(s2, stats[1].value, stats[1].label, ORANGE, BLACK, 2, X0 + 490) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ profile: a brand new profile on a phone: badge + four posts dropping in */

const Profile: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const [tt, fol, four] = useCues(scene, props.cues ?? []);
  const fp = usePop(fol, 0.6);
  const covers: string[] = props.covers ?? ["recipe", "travel", "gym", "study"];
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      {props.tape ? <Tape text={props.tape} /> : null}
      <div style={{ position: "absolute", left: W / 2 - 300, top: 380 }}>
        <Pop at={0} rot={-1.5} from={0.6}>
          <Phone w={600} h={880}>
            <div style={{ padding: "40px 34px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <Anon size={130} color="#c9c9c9" bg="#ececec" />
                <div style={{ flex: 1 }}>
                  <div style={{ width: 230, height: 30, borderRadius: 15, background: BLACK }} />
                  <div style={{ width: 150, height: 20, borderRadius: 10, background: "#d6d6d6", marginTop: 14 }} />
                </div>
                <div style={{ transform: `scale(${popAt(frame, Math.min(tt, 8)).scale})` }}>
                  <BrandBadge name={props.platform ?? "tiktok"} size={76} />
                </div>
              </div>
              <div style={{ marginTop: 30, display: "flex", justifyContent: "center" }}>
                <div style={{ transform: `scale(${fp.scale}) rotate(-2deg)`, opacity: fp.opacity, background: ORANGE, border: `3px solid ${BLACK}`, borderRadius: 22, padding: "10px 34px 4px", boxShadow: `6px 6px 0 ${BLACK}`, whiteSpace: "nowrap", ...A(84) }}>{props.badge ?? "1 FOLLOWER"}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 34 }}>
                {[0, 1, 2, 3].map((i) => {
                  const at = four + i * 5;
                  const p = interpolate(frame, [at, at + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
                  return (
                    <div key={i} style={{ height: 215, borderRadius: 18, overflow: "hidden", position: "relative", border: frame >= at ? `3px solid ${BLACK}` : "3px dashed #cfcfcf", boxSizing: "border-box", background: "#f2f2f2" }}>
                      <div style={{ position: "absolute", inset: 0, transform: `scale(${p})`, opacity: frame < at ? 0 : 1 }}>
                        <Cover id={covers[i % covers.length]} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Phone>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ views: a post, a views card and a stamped word (black) */

const Views: React.FC<SceneProps> = ({ scene, props }) => {
  const [v, viral] = useCues(scene, props.cues ?? []);
  return (
    <AbsoluteFill>
      <Background kind="black" />
      <div style={{ position: "absolute", left: W / 2 - 250, top: 280 }}>
        <Pop at={0} rot={-3} from={0.6}>
          <div style={{ width: 500, height: 660, borderRadius: 36, overflow: "hidden", position: "relative", border: `8px solid ${ORANGE}`, boxSizing: "border-box" }}>
            <Cover id={props.cover ?? "recipe"} />
          </div>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0, top: 820, width: SW, display: "flex", justifyContent: "center" }}>
        <Pop at={Math.min(v, 12)} rot={2}>
          <Card edge="#fff" style={{ padding: "22px 50px 14px", display: "flex", alignItems: "center", gap: 26 }}>
            <Ico name="play" size={96} color={BLACK} sw={2.2} />
            <div style={{ ...A(170), whiteSpace: "nowrap" }}>{props.text ?? "1.9K VIEWS"}</div>
          </Card>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: X0, top: 1050, width: SW, display: "flex", justifyContent: "center" }}>
        <Stamp at={viral} text={props.stamp ?? "NOT VIRAL"} size={150} rot={-5} color="#fff" />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ result_card: small headline + a big tick card (orange) */

const ResultCard: React.FC<SceneProps> = ({ scene, props }) => {
  const [paid] = useCues(scene, [props.cue]);
  const a = Math.min(paid, 8);
  const lines: string[] = props.lines ?? ["1 PAID", "CONVERSION"];
  return (
    <AbsoluteFill>
      <Background kind="orange" />
      <div style={{ position: "absolute", left: X0, top: 280, width: SW, textAlign: "center" }}>
        <Slam t={props.head ?? "AND IT STILL BROUGHT IN"} at={0} size={84} color="#fff" />
      </div>
      <div style={{ position: "absolute", left: X0 + 30, top: 430, width: SW - 60 }}>
        <Pop at={a} rot={-2} from={0.6}>
          <Card style={{ padding: "50px 30px 44px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <Mark kind="tick" size={210} />
            <div style={{ ...A(250), marginTop: 30, whiteSpace: "nowrap" }}>{lines[0]}</div>
            <div style={{ ...A(170), whiteSpace: "nowrap" }}>{lines[1] ?? ""}</div>
          </Card>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ fan_out: a post in the middle, two rings of people fanning out */

const FanOut: React.FC<SceneProps> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const [fol, holds, shown] = useCues(scene, props.cues ?? []);
  const lines: string[] = props.lines ?? ["FOLLOWERS", "*DON'T MATTER*"];
  const cy = 910;
  const ring = (n: number, R: number, at: number, k: string) =>
    Array.from({ length: n }, (_, i) => {
      const ang = (i / n) * Math.PI * 2 + (k === "b" ? 0.3 : 0);
      const p = interpolate(frame, [at + i * 0.8, at + 5 + i * 0.8], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
      return (
        <div key={k + i} style={{ position: "absolute", left: W / 2 + Math.cos(ang) * R * p - 34, top: cy + Math.sin(ang) * R * 0.78 * p - 34, transform: `scale(${p})`, opacity: frame < at ? 0 : 1 }}>
          <Anon size={68} color="#fff" bg={k === "a" ? BLACK : ORANGE} />
        </div>
      );
    });
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      <div style={{ position: "absolute", left: X0, top: 262, width: SW, textAlign: "center" }}>
        <Slam t={lines[0]} at={Math.min(fol, 10) - 4} size={170} />
        <Slam t={lines[1] ?? ""} at={Math.min(fol, 10) + 2} size={150} style={{ marginTop: 6 }} />
      </div>
      {ring(6, 190, holds, "a")}
      {ring(14, 380, shown, "b")}
      <div style={{ position: "absolute", left: W / 2 - 80, top: cy - 100 }}>
        <Pop at={2} rot={-3} from={0.5}>
          <div style={{ width: 160, height: 200, borderRadius: 24, overflow: "hidden", position: "relative", border: `3px solid ${BLACK}`, boxShadow: `6px 6px 0 ${BLACK}`, boxSizing: "border-box" }}>
            <Cover id={props.cover ?? "recipe"} />
          </div>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ ticker: a full-screen stack of tape banners (also available as the `tape` prop on pills, strike_list and profile) */

const Ticker: React.FC<SceneProps> = ({ scene, props }) => {
  const lines: Item[] = props.lines ?? [];
  const at = useCues(scene, lines.map((l) => l.cue));
  if (at.length) at[0] = Math.min(at[0], 3);
  const bg: Bg = props.bg ?? "cream";
  const size = (t: string) => Math.min(300, Math.floor(SW / (t.length * 0.54)));
  return (
    <AbsoluteFill>
      <Background kind={bg} />
      {[268, 1150].map((y, i) => (
        <Tape key={y} text={props.text} y={y} rot={i ? 3 : -3} bg={bg === "orange" ? BLACK : ORANGE} color={bg === "orange" ? "#fff" : BLACK} speed={i ? -6 : 6} />
      ))}
      <div style={{ position: "absolute", left: X0, top: 400, width: SW, height: 700, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
        {lines.map((l, i) => (
          <Slam key={i} t={tx(l)} at={at[i]} size={size(tx(l).replace(/\*/g, ""))} bg={bg} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ footage: a video clip full-frame (AI footage, a reaction, a song video) with optional tag and headline */

const Footage: React.FC<SceneProps> = ({ scene, props }) => {
  const { fps } = useVideoConfig();
  const [tagAt, headAt] = useCues(scene, [props.tagCue, props.headCue]);
  const src = /^(https?:|data:|blob:)/.test(props.url) ? props.url : staticFile(String(props.url).replace(/^\//, ""));
  const video = (
    <OffthreadVideo src={src} trimBefore={Math.round((props.startFrom ?? 0) * fps)} volume={props.volume ?? 0} muted={(props.volume ?? 0) === 0} style={{ width: "100%", height: "100%", objectFit: props.fit ?? "cover" }} />
  );
  const lines: string[] = props.head ? (Array.isArray(props.head) ? props.head : [props.head]) : [];
  const size = (t: string) => Math.min(190, Math.floor(SW / (t.replace(/\*/g, "").length * 0.54)));
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      {props.clipSeconds ? (
        <Loop durationInFrames={Math.max(1, Math.round((props.clipSeconds - (props.startFrom ?? 0)) * fps))}>{video}</Loop>
      ) : (
        video
      )}
      {props.dim ? <AbsoluteFill style={{ background: `rgba(10,10,10,${props.dim})` }} /> : null}
      {props.tag || lines.length ? <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.72) 0%, rgba(10,10,10,0.45) 22%, rgba(10,10,10,0) 42%)" }} /> : null}
      {props.tag ? (
        <div style={{ position: "absolute", left: X0, top: 268, width: SW, display: "flex", justifyContent: "center" }}>
          <Pop at={Math.min(tagAt, 2)} rot={-2}>
            <Tag size={46} bg={ORANGE} color={BLACK}>
              {props.tag}
            </Tag>
          </Pop>
        </div>
      ) : null}
      {lines.length ? (
        <div style={{ position: "absolute", left: X0, top: props.tag ? 400 : 280, width: SW, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          {lines.map((l, i) => (
            <Slam key={i} t={l} at={headAt + i * 5} size={size(l)} color="#fff" bg="black" style={{ textShadow: "0 6px 0 rgba(10,10,10,0.55)" }} />
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const SCENES: Record<string, React.FC<SceneProps>> = {
  footage: Footage,
  ticker: Ticker,
  pills: Pills,
  checklist: Checklist,
  strike_list: StrikeList,
  headline: Headline,
  phones: Phones,
  icon_flow: IconFlow,
  logo_stats: LogoStats,
  product_box: ProductBoxScene,
  steps: Steps,
  big_number: BigNumber,
  price_tag: PriceTag,
  launch_grid: LaunchGrid,
  clock: Clock,
  cta: Cta,
  block_stack: BlockStack,
  have_need: HaveNeed,
  walk: Walk,
  swipe_phone: SwipePhone,
  profile: Profile,
  views: Views,
  result_card: ResultCard,
  fan_out: FanOut,
};
