// src/dynamic/comp_fade_out_glow.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Img, Sequence } from "remotion";
import { jsx, jsxs } from "react/jsx-runtime";
var FadeOutGlow = ({
  src = "",
  subtitleText = "\u671F\u5F85\u4E0B\u4E00\u6B21\u76F8\u9047",
  glowColor = "#FFD700",
  glowIntensity = 0.5,
  glowRadius = 30,
  fadeDuration = 2
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeOutStartFrame = Math.max(0, durationInFrames - Math.floor(fadeDuration * 30));
  const opacity = interpolate(
    frame,
    [fadeOutStartFrame, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease)
    }
  );
  const glowIntensityProgress = interpolate(
    frame,
    [fadeOutStartFrame, fadeOutStartFrame + Math.floor(fadeDuration * 30 * 0.6), durationInFrames],
    [0, glowIntensity * 1.2, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease)
    }
  );
  const currentGlowRadius = interpolate(
    frame,
    [fadeOutStartFrame, durationInFrames],
    [0, glowRadius * 2],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease)
    }
  );
  const subtitleOpacity = interpolate(
    frame,
    [fadeOutStartFrame - 30, fadeOutStartFrame],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease)
    }
  );
  return /* @__PURE__ */ jsxs(AbsoluteFill, { style: {
    backgroundColor: "black"
  }, children: [
    /* @__PURE__ */ jsx(AbsoluteFill, { style: {
      opacity,
      filter: `blur(${currentGlowRadius * 0.3}px)`
    }, children: src && /* @__PURE__ */ jsx(
      Img,
      {
        src,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }
      }
    ) }),
    /* @__PURE__ */ jsx(AbsoluteFill, { style: {
      backgroundColor: glowColor,
      opacity: glowIntensityProgress * 0.3,
      mixBlendMode: "screen"
    } }),
    /* @__PURE__ */ jsx(AbsoluteFill, { style: {
      background: `radial-gradient(circle at 50% 50%, ${glowColor} ${currentGlowRadius}px, transparent ${currentGlowRadius * 2}px)`,
      opacity: glowIntensityProgress * 0.4,
      mixBlendMode: "overlay"
    } }),
    /* @__PURE__ */ jsx(Sequence, { from: Math.max(0, fadeOutStartFrame - 30), children: /* @__PURE__ */ jsx(AbsoluteFill, { style: {
      justifyContent: "flex-end",
      alignItems: "center",
      paddingBottom: 100
    }, children: /* @__PURE__ */ jsx("div", { style: {
      color: "#ffffff",
      fontSize: 40,
      fontWeight: 600,
      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
      textShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
      opacity: subtitleOpacity,
      textAlign: "center",
      padding: "20px 40px",
      background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%)",
      borderRadius: 8,
      maxWidth: "80%"
    }, children: subtitleText }) }) })
  ] });
};
var comp_fade_out_glow_default = FadeOutGlow;
export {
  comp_fade_out_glow_default as default
};
