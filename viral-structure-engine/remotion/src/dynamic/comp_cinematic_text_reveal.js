// src/dynamic/comp_cinematic_text_reveal.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Img, spring } from "remotion";
import { jsx, jsxs } from "react/jsx-runtime";
function CinematicTextReveal(props) {
  const { text, fontColor, fontSize, glowIntensity, animation, backgroundDim } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const textStartFrame = 15;
  const textHoldFrames = durationInFrames - 45;
  const textFadeOutStart = durationInFrames - 30;
  const scale = spring({
    frame: frame - textStartFrame,
    fps: 30,
    config: {
      damping: 12,
      stiffness: 100,
      mass: 0.5
    }
  });
  const textOpacity = interpolate(
    frame,
    [textStartFrame, textStartFrame + 20, textFadeOutStart, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.ease
    }
  );
  const backgroundOpacity = interpolate(
    frame,
    [textStartFrame, textStartFrame + 20, durationInFrames],
    [1, 1 - backgroundDim, 1 - backgroundDim],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    }
  );
  const glowOpacity = interpolate(
    frame,
    [textStartFrame, textStartFrame + 20, textFadeOutStart, durationInFrames],
    [0, glowIntensity, glowIntensity, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    }
  );
  const textY = interpolate(
    frame,
    [textStartFrame, textStartFrame + 30],
    [1200, 960],
    // 从下方移动到中心
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic)
    }
  );
  return /* @__PURE__ */ jsxs(AbsoluteFill, { style: containerStyle, children: [
    /* @__PURE__ */ jsx(AbsoluteFill, { style: backgroundLayerStyle, children: /* @__PURE__ */ jsx(
      Img,
      {
        src: "https://images.unsplash.com/photo-1578894381163-e7192f6c1b4a?w=1080&h=1920&fit=crop",
        style: {
          ...backgroundImageStyle,
          opacity: backgroundOpacity
        }
      }
    ) }),
    /* @__PURE__ */ jsx(AbsoluteFill, { style: glowLayerStyle, children: /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          ...glowTextStyle,
          fontSize: fontSize + 10,
          opacity: glowOpacity,
          color: fontColor,
          filter: `blur(${20 * glowIntensity}px)`
        },
        children: text
      }
    ) }),
    /* @__PURE__ */ jsx(AbsoluteFill, { style: textLayerStyle, children: /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          ...textStyle,
          fontSize,
          color: fontColor,
          opacity: textOpacity,
          transform: `translateY(${textY - 960}px) scale(${scale})`,
          textShadow: `0 0 ${20 * glowIntensity}px ${fontColor}, 0 0 ${40 * glowIntensity}px ${fontColor}, 0 0 ${60 * glowIntensity}px ${fontColor}`
        },
        children: text
      }
    ) })
  ] });
}
var containerStyle = {
  width: "100%",
  height: "100%",
  overflow: "hidden",
  backgroundColor: "#000"
};
var backgroundLayerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};
var backgroundImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  transition: "opacity 0.3s"
};
var glowLayerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2
};
var glowTextStyle = {
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontWeight: "bold",
  letterSpacing: "8px",
  userSelect: "none"
};
var textLayerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 3
};
var textStyle = {
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontWeight: "bold",
  letterSpacing: "6px",
  userSelect: "none",
  whiteSpace: "nowrap"
};
export {
  CinematicTextReveal as default
};
