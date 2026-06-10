// src/dynamic/comp_film_grain_ken_burns.tsx
import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill, Img, spring } from "remotion";
import React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var FilmGrainKenBurns = ({
  src = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1920&fit=crop",
  animation = "zoom_in",
  startScale = 1,
  endScale = 1.15,
  duration = 4,
  effects = { grainIntensity: 0.3, glowIntensity: 0.2, glowColor: "#FFD700" }
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const totalFrames = duration * fps;
  const progress = interpolate(frame, [0, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease)
  });
  let currentScale;
  let translateX = 0;
  let translateY = 0;
  switch (animation) {
    case "zoom_in":
      currentScale = interpolate(progress, [0, 1], [startScale, endScale]);
      break;
    case "zoom_out":
      currentScale = interpolate(progress, [0, 1], [endScale, startScale]);
      break;
    case "pan_left":
      currentScale = startScale;
      translateX = interpolate(progress, [0, 1], [0, -width * 0.2]);
      break;
    case "pan_right":
      currentScale = startScale;
      translateX = interpolate(progress, [0, 1], [0, width * 0.2]);
      break;
    default:
      currentScale = startScale;
  }
  const grainIntensity = effects.grainIntensity || 0.3;
  const grainCanvas = React.useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.random() * 255 * grainIntensity;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255 * grainIntensity;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  }, [width, height, grainIntensity]);
  const glowIntensity = effects.glowIntensity || 0.2;
  const glowColor = effects.glowColor || "#FFD700";
  const glowOpacity = interpolate(
    spring({
      frame,
      fps,
      config: { damping: 15, stiffness: 50 }
    }),
    [0, 1],
    [0, glowIntensity]
  );
  const subtitleOpacity = interpolate(frame, [totalFrames * 0.5, totalFrames * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ jsxs(AbsoluteFill, { style: { backgroundColor: "black" }, children: [
    /* @__PURE__ */ jsx(
      AbsoluteFill,
      {
        style: {
          transform: `scale(${currentScale}) translate(${translateX}px, ${translateY}px)`,
          transition: "transform 0.1s ease-out"
        },
        children: /* @__PURE__ */ jsx(
          Img,
          {
            src,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      AbsoluteFill,
      {
        style: {
          background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, transparent 70%)`,
          opacity: glowOpacity,
          pointerEvents: "none"
        }
      }
    ),
    grainCanvas && /* @__PURE__ */ jsx(
      AbsoluteFill,
      {
        style: {
          backgroundImage: `url(${grainCanvas})`,
          backgroundSize: "cover",
          mixBlendMode: "overlay",
          opacity: 0.5,
          pointerEvents: "none"
        }
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "white",
          fontSize: 36,
          fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
          textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
          opacity: subtitleOpacity,
          letterSpacing: 4,
          padding: "0 40px"
        },
        children: "\u5915\u9633\u4E0B\u7684\u767D\u5854\uFF0C\u662F\u8FD9\u5EA7\u57CE\u5E02\u6700\u6E29\u67D4\u7684\u8BD7"
      }
    )
  ] });
};
var comp_film_grain_ken_burns_default = FilmGrainKenBurns;
export {
  comp_film_grain_ken_burns_default as default
};
