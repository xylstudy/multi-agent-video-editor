// src/dynamic/comp_color_graded_ken_burns.tsx
import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill, Img, spring } from "remotion";
import { jsx, jsxs } from "react/jsx-runtime";
var ColorGradedKenBurns = ({
  animation = "zoom_in",
  startScale = 1,
  endScale = 1.2,
  duration = 15,
  colorGrading = { startColor: [1, 1, 1], endColor: [1, 0.8, 0.5] },
  sourceMaterialId,
  subtitleText = ""
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const scale = interpolate(frame, [0, duration * fps - 1], [startScale, endScale], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic)
  });
  let translateX = 0;
  let translateY = 0;
  if (animation === "pan_left") {
    translateX = interpolate(frame, [0, duration * fps - 1], [0, -width * 0.15], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic)
    });
  } else if (animation === "pan_right") {
    translateX = interpolate(frame, [0, duration * fps - 1], [0, width * 0.15], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic)
    });
  } else if (animation === "zoom_out") {
    translateY = interpolate(frame, [0, duration * fps - 1], [0, -height * 0.1], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic)
    });
  }
  const progress = interpolate(frame, [0, duration * fps - 1], [0, 1], {
    extrapolateRight: "clamp"
  });
  const r = interpolate(progress, [0, 1], [colorGrading.startColor[0], colorGrading.endColor[0]]);
  const g = interpolate(progress, [0, 1], [colorGrading.startColor[1], colorGrading.endColor[1]]);
  const b = interpolate(progress, [0, 1], [colorGrading.startColor[2], colorGrading.endColor[2]]);
  const subtitleOpacity = spring({
    frame: frame - fps * 0.5,
    fps,
    config: {
      damping: 12,
      mass: 0.5,
      stiffness: 80
    }
  });
  const containerStyle = {
    width,
    height,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000"
  };
  const imageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
    filter: `sepia(${progress * 0.3}) saturate(${1 - progress * 0.3}) contrast(${1 + progress * 0.1})`,
    opacity: 1
  };
  const overlayStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${progress * 0.35})`,
    pointerEvents: "none"
  };
  const subtitleStyle = {
    position: "absolute",
    bottom: "12%",
    left: "5%",
    right: "5%",
    color: "#fff",
    fontSize: 36,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontWeight: 400,
    textAlign: "center",
    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
    opacity: subtitleOpacity,
    lineHeight: 1.6,
    padding: "0 20px",
    letterSpacing: "0.05em"
  };
  return /* @__PURE__ */ jsxs(AbsoluteFill, { style: containerStyle, children: [
    /* @__PURE__ */ jsx(
      Img,
      {
        src: sourceMaterialId || "https://via.placeholder.com/1080x1920",
        style: imageStyle
      }
    ),
    /* @__PURE__ */ jsx("div", { style: overlayStyle }),
    subtitleText && /* @__PURE__ */ jsx("div", { style: subtitleStyle, children: subtitleText })
  ] });
};
var comp_color_graded_ken_burns_default = ColorGradedKenBurns;
export {
  comp_color_graded_ken_burns_default as default
};
