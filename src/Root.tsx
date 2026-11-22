import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { DEFAULT_FPS, HEIGHT, Plan, planSeconds, WIDTH } from "./plan";
import { TapVideo } from "./Video";

type Props = { plan: Plan };

// Shown in Remotion Studio when no plan is passed.
const SAMPLE: Plan = {
  scenes: [
    { type: "pills", duration: 3, props: { tape: "0 FOLLOWERS · NO PRODUCT · NO FACE", flip: true, items: [{ text: "0 FOLLOWERS", cue: 0.1 }, { text: "NO PRODUCT", cue: 0.8 }, { text: "NO FACE", cue: 1.5 }] } },
    { type: "cta", duration: 3, props: { cue: 0.5 } },
  ],
};

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const fps = props.plan.fps ?? DEFAULT_FPS;
  return { fps, width: WIDTH, height: HEIGHT, durationInFrames: Math.max(1, Math.ceil(planSeconds(props.plan) * fps)) };
};

export const RemotionRoot: React.FC = () => (
  <Composition id="TapVideo" component={TapVideo} width={WIDTH} height={HEIGHT} fps={DEFAULT_FPS} durationInFrames={DEFAULT_FPS * 6} defaultProps={{ plan: SAMPLE }} calculateMetadata={calculateMetadata} />
);
