// src/dynamic/comp_photo_collage.tsx
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, Easing, spring, random } from "remotion";
import { jsx, jsxs } from "react/jsx-runtime";
var PhotoCollage = ({
  images = [],
  transitionDuration = 0.5,
  stickerConfig
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (images.length === 0) {
    return /* @__PURE__ */ jsx(AbsoluteFill, { style: {
      backgroundColor: "#1a1a1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#666",
      fontSize: 32,
      fontFamily: "PingFang SC, Microsoft YaHei"
    }, children: "\u6682\u65E0\u7167\u7247" });
  }
  const transitionFrames = Math.round(transitionDuration * fps);
  const displayFramesPerImage = 30;
  const totalFramesPerImage = displayFramesPerImage + transitionFrames * 2;
  const currentIndex = Math.floor(frame / totalFramesPerImage);
  const localFrame = frame % totalFramesPerImage;
  const safeIndex = Math.min(currentIndex, images.length - 1);
  const nextIndex = Math.min(safeIndex + 1, images.length - 1);
  let transitionProgress = 1;
  let isEntering = false;
  let isExiting = false;
  if (localFrame < transitionFrames) {
    isEntering = true;
    transitionProgress = localFrame / transitionFrames;
  } else if (localFrame < transitionFrames + displayFramesPerImage) {
    transitionProgress = 1;
  } else if (localFrame < totalFramesPerImage) {
    isExiting = true;
    transitionProgress = 1 - (localFrame - transitionFrames - displayFramesPerImage) / transitionFrames;
  }
  const scale = interpolate(transitionProgress, [0, 1], [0.8, 1.1], {
    easing: Easing.bezier(0.25, 0.1, 0.25, 1)
  });
  const opacity = interpolate(transitionProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const rotation = interpolate(transitionProgress, [0, 1], [-5, 5]);
  const stickerSpring = spring({
    frame: frame - safeIndex * totalFramesPerImage,
    fps,
    config: {
      damping: 12,
      mass: 0.5,
      stiffness: 100
    }
  });
  const stickerOpacity = interpolate(stickerSpring, [0, 1], [0, 1]);
  const stickerScale = interpolate(stickerSpring, [0, 1], [0.5, 1.2]);
  const stickerBounce = interpolate(stickerSpring, [0, 0.5, 1], [0, -20, 0]);
  const randomRotation = interpolate(
    random(safeIndex * 100),
    [0, 1],
    [-3, 3]
  );
  const randomX = interpolate(
    random(safeIndex * 100 + 1),
    [0, 1],
    [-20, 20]
  );
  const randomY = interpolate(
    random(safeIndex * 100 + 2),
    [0, 1],
    [-20, 20]
  );
  const renderSticker = () => {
    if (!stickerConfig) return null;
    const stickerStyle = {
      position: "absolute",
      bottom: 60 + stickerBounce,
      right: 40,
      transform: `scale(${stickerScale})`,
      opacity: stickerOpacity,
      fontFamily: "PingFang SC, Microsoft YaHei",
      zIndex: 10
    };
    switch (stickerConfig.type) {
      case "location_tag":
        return /* @__PURE__ */ jsxs("div", { style: {
          ...stickerStyle,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(10px)",
          padding: "12px 24px",
          borderRadius: 24,
          display: "flex",
          alignItems: "center",
          gap: 8
        }, children: [
          /* @__PURE__ */ jsx("span", { style: { fontSize: 20 }, children: "\u{1F4CD}" }),
          /* @__PURE__ */ jsx("span", { style: { color: "#fff", fontSize: 20, fontWeight: 500 }, children: stickerConfig.text || "\u5730\u70B9" })
        ] });
      case "emoji":
        return /* @__PURE__ */ jsx("div", { style: {
          ...stickerStyle,
          fontSize: 48,
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))"
        }, children: stickerConfig.emoji || "\u2B50" });
      case "star":
        return /* @__PURE__ */ jsx("div", { style: {
          ...stickerStyle,
          fontSize: 36,
          color: "#FFD700",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
          animation: "none"
        }, children: "\u2B50" });
      default:
        return null;
    }
  };
  const renderBorder = () => {
    return /* @__PURE__ */ jsx("div", { style: {
      position: "absolute",
      top: -4,
      left: -4,
      right: -4,
      bottom: -4,
      border: "4px solid rgba(255,255,255,0.3)",
      borderRadius: 12,
      zIndex: 5
    } });
  };
  return /* @__PURE__ */ jsxs(AbsoluteFill, { style: {
    backgroundColor: "#0a0a0a",
    overflow: "hidden"
  }, children: [
    /* @__PURE__ */ jsxs("div", { style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: `translate(-50%, -50%) translate(${randomX}px, ${randomY}px) scale(${scale}) rotate(${rotation + randomRotation}deg)`,
      opacity,
      width: "85%",
      height: "75%",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      transition: "all 0.1s ease"
    }, children: [
      /* @__PURE__ */ jsx(
        Img,
        {
          src: images[safeIndex],
          style: {
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }
        }
      ),
      renderBorder()
    ] }),
    isExiting && safeIndex < images.length - 1 && /* @__PURE__ */ jsxs("div", { style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: `translate(-50%, -50%) scale(${interpolate(transitionProgress, [0, 1], [0.9, 1])})`,
      opacity: interpolate(transitionProgress, [0, 1], [0, 1]),
      width: "85%",
      height: "75%",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
    }, children: [
      /* @__PURE__ */ jsx(
        Img,
        {
          src: images[nextIndex],
          style: {
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }
        }
      ),
      renderBorder()
    ] }),
    renderSticker(),
    /* @__PURE__ */ jsx("div", { style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `radial-gradient(circle at ${50 + randomX}% ${30 + randomY}%, rgba(255,255,255,0.1) 0%, transparent 60%)`,
      pointerEvents: "none",
      zIndex: 2
    } })
  ] });
};
var comp_photo_collage_default = PhotoCollage;
export {
  comp_photo_collage_default as default
};
