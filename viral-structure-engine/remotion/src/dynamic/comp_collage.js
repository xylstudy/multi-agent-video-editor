// src/dynamic/comp_collage.tsx
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill, Img } from "remotion";
import { jsx, jsxs } from "react/jsx-runtime";
var Collage = ({ images, layout, animation }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const duration = durationInFrames / fps;
  const defaultImages = [
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtojmm7Tlm77niYc8L3RleHQ+PC9zdmc+",
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtojmm7Tlm77niYc8L3RleHQ+PC9zdmc+",
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtojmm7Tlm77niYc8L3RleHQ+PC9zdmc+",
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtojmm7Tlm77niYc8L3RleHQ+PC9zdmc+"
  ];
  const displayImages = images.length >= 4 ? images.slice(0, 4) : [...images, ...defaultImages].slice(0, 4);
  const startPositions = [
    { x: -300, y: -300 },
    // 左上
    { x: 300, y: -300 },
    // 右上
    { x: -300, y: 300 },
    // 左下
    { x: 300, y: 300 }
    // 右下
  ];
  const endPositions = [
    { x: 0, y: 0 },
    { x: 540, y: 0 },
    { x: 0, y: 960 },
    { x: 540, y: 960 }
  ];
  const delays = [0, 5, 10, 15];
  const animDuration = 20;
  const getProgress = (index) => {
    const delay = delays[index];
    const localFrame = Math.max(0, frame - delay);
    const progress = Math.min(localFrame / animDuration, 1);
    return progress;
  };
  const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const renderImage = (index) => {
    const progress = getProgress(index);
    const easedProgress = easeOutBack(progress);
    const startPos = startPositions[index];
    const endPos = endPositions[index];
    const currentX = interpolate(easedProgress, [0, 1], [startPos.x, endPos.x], {
      extrapolateRight: "clamp"
    });
    const currentY = interpolate(easedProgress, [0, 1], [startPos.y, endPos.y], {
      extrapolateRight: "clamp"
    });
    const scale = interpolate(easedProgress, [0, 1], [0.5, 1], {
      extrapolateRight: "clamp"
    });
    const rotation = interpolate(easedProgress, [0, 1], [-15, 0], {
      extrapolateRight: "clamp"
    });
    const opacity = interpolate(progress, [0, 0.3, 1], [0, 0.5, 1], {
      extrapolateRight: "clamp"
    });
    const shadowOpacity = interpolate(progress, [0.5, 1], [0, 0.3], {
      extrapolateRight: "clamp"
    });
    return /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          left: currentX,
          top: currentY,
          width: 540,
          height: 960,
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          opacity,
          boxShadow: `0 0 20px rgba(0,0,0,${shadowOpacity})`,
          borderRadius: 8,
          overflow: "hidden"
        },
        children: /* @__PURE__ */ jsx(
          Img,
          {
            src: displayImages[index],
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }
          }
        )
      },
      index
    );
  };
  return /* @__PURE__ */ jsxs(AbsoluteFill, { style: { backgroundColor: "#1a1a2e" }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "radial-gradient(circle at center, rgba(255,215,0,0.1) 0%, transparent 70%)"
        }
      }
    ),
    [0, 1, 2, 3].map((i) => renderImage(i)),
    [...Array(12)].map((_, i) => {
      const starDelay = i * 3 % 30;
      const starProgress = Math.max(0, Math.min((frame - starDelay) / 15, 1));
      const starOpacity = interpolate(starProgress, [0, 0.5, 1], [0, 1, 0]);
      const starSize = interpolate(starProgress, [0, 1], [5, 15]);
      const starX = (i * 90 + 45) % 1080;
      const starY = (i * 160 + 80) % 1920;
      return /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            position: "absolute",
            left: starX,
            top: starY,
            width: starSize,
            height: starSize,
            backgroundColor: "#FFD700",
            borderRadius: "50%",
            opacity: starOpacity,
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 6px #FFD700"
          }
        },
        `star-${i}`
      );
    })
  ] });
};
var comp_collage_default = Collage;
export {
  comp_collage_default as default
};
