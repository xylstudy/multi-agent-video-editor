import { Composition } from "remotion";
import { VideoSchemeComposition } from "./VideoScheme";
import type { RenderInput } from "./types/schema";
// 注册所有动态组件（含 LLM 生成的自定义组件）
import "./dynamic/index";
import { KenBurnsTestSuite } from "./KenBurnsTest";
import { EffectsShowcase } from "./EffectsShowcase";
import { BeijingVlog } from "./BeijingVlog";
import { ForegroundSplitShowcase } from "./ForegroundSplit";
import { BeijingVlogSegmented } from "./BeijingVlogSegmented";
import { VlogTechniquesShowcase } from "./VlogTechniquesShowcase";
import { BeijingVlogVariety, BEIJING_VARIETY_DURATION } from "./BeijingVlogVariety";

const fps = 30;

function calcDurationInFrames(props: Record<string, unknown>): number {
  const scheme = (props as unknown as RenderInput).scheme;
  if (!scheme?.storyboard?.length) return 30 * 60;

  const totalSec = scheme.storyboard.reduce(
    (acc, f) => acc + (f.duration ?? 3),
    0
  );
  return Math.max(30, Math.ceil(totalSec * fps));
}

const defaultProps: RenderInput = {
  scheme: {
    id: "default",
    title: "Vlog",
    target_topic: "",
    target_duration: 60,
    structure_type: "",
    storyboard: [],
    total_duration: 60,
  },
  material_map: {},
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoScheme"
        component={VideoSchemeComposition as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={30 * 60}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={defaultProps as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => ({
          durationInFrames: calcDurationInFrames(props),
          props,
        })}
      />
      <Composition
        id="KenBurnsTest"
        component={KenBurnsTestSuite}
        durationInFrames={240}
        fps={fps}
        width={1080}
        height={1920}
      />
      <Composition
        id="EffectsShowcase"
        component={EffectsShowcase}
        durationInFrames={270}
        fps={fps}
        width={1080}
        height={1920}
      />
      <Composition
        id="BeijingVlog"
        component={BeijingVlog as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={315}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={{ material_map: {} }}
      />
      <Composition
        id="ForegroundSplit"
        component={ForegroundSplitShowcase as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={30 + 10 * 60 + 30}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={{ material_map: {} }}
      />
      <Composition
        id="BeijingVlogSegmented"
        component={BeijingVlogSegmented as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={30 + 12 * 50 + 50 + 35 + 30}
        fps={fps}
        width={1080}
        height={1920}
      />
      <Composition
        id="VlogTechniquesShowcase"
        component={VlogTechniquesShowcase as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={30 + 10 * 45 + 45 + 30 + 30}
        fps={fps}
        width={1080}
        height={1920}
      />
      <Composition
        id="BeijingVlogVariety"
        component={BeijingVlogVariety as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={BEIJING_VARIETY_DURATION}
        fps={fps}
        width={1080}
        height={1920}
      />
    </>
  );
};
