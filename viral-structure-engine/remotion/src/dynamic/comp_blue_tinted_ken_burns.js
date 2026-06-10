// src/dynamic/comp_blue_tinted_ken_burns.tsx
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { jsx, jsxs } from "react/jsx-runtime";
var BlueTintedKenBurns = ({
  src,
  animation = "zoom_in",
  startScale = 1,
  endScale = 1.15,
  duration = 4,
  colorOverlay = { color: "#ADD8E6", opacity: 0.3 }
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalFrames = duration * fps;
  const progress = Math.min(frame / totalFrames, 1);
  let scale;
  let translateX;
  let translateY;
  switch (animation) {
    case "zoom_in":
      scale = interpolate(progress, [0, 1], [startScale, endScale]);
      translateX = 0;
      translateY = 0;
      break;
    case "zoom_out":
      scale = interpolate(progress, [0, 1], [endScale, startScale]);
      translateX = 0;
      translateY = 0;
      break;
    case "pan_left":
      scale = startScale;
      translateX = interpolate(progress, [0, 1], [0, -100]);
      translateY = 0;
      break;
    case "pan_right":
      scale = startScale;
      translateX = interpolate(progress, [0, 1], [0, 100]);
      translateY = 0;
      break;
    default:
      scale = startScale;
      translateX = 0;
      translateY = 0;
  }
  const imageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`
  };
  const overlayStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: colorOverlay.color,
    opacity: colorOverlay.opacity,
    pointerEvents: "none"
  };
  return /* @__PURE__ */ jsxs(AbsoluteFill, { children: [
    /* @__PURE__ */ jsx("div", { style: { width: "100%", height: "100%", overflow: "hidden" }, children: /* @__PURE__ */ jsx(Img, { src, style: imageStyle }) }),
    /* @__PURE__ */ jsx("div", { style: overlayStyle })
  ] });
};
var comp_blue_tinted_ken_burns_default = BlueTintedKenBurns;
export {
  comp_blue_tinted_ken_burns_default as default
};
