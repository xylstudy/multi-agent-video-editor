// src/dynamic/comp_fast_montage.tsx
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill, Img, Sequence, spring } from "remotion";
import { jsx, jsxs } from "react/jsx-runtime";
var MOCK_IMAGES = [
  "https://picsum.photos/seed/hutong1/1080/1920",
  "https://picsum.photos/seed/redwall/1080/1920",
  "https://picsum.photos/seed/sign/1080/1920",
  "https://picsum.photos/seed/food1/1080/1920",
  "https://picsum.photos/seed/hutong2/1080/1920",
  "https://picsum.photos/seed/food2/1080/1920",
  "https://picsum.photos/seed/street/1080/1920",
  "https://picsum.photos/seed/market/1080/1920",
  "https://picsum.photos/seed/art/1080/1920",
  "https://picsum.photos/seed/culture/1080/1920"
];
var getAnimationStyle = (frame, segment, segmentDuration) => {
  const localFrame = frame - segment.start_frame;
  const progress = localFrame / segmentDuration;
  switch (segment.animation) {
    case "zoom_in":
      return {
        transform: `scale(${interpolate(progress, [0, 1], [1.2, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp"
        })})`
      };
    case "zoom_out":
      return {
        transform: `scale(${interpolate(progress, [0, 1], [1, 1.2], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp"
        })})`
      };
    case "pan_left":
      return {
        transform: `translateX(${interpolate(progress, [0, 1], [0, -100], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp"
        })}px)`
      };
    case "pan_right":
      return {
        transform: `translateX(${interpolate(progress, [0, 1], [0, 100], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp"
        })}px)`
      };
    default:
      return {};
  }
};
var FastMontage = ({
  montage_segments = [],
  subtitle = "",
  imageUrls = MOCK_IMAGES
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const subtitleOpacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    }
  );
  const subtitleScale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      mass: 0.5,
      stiffness: 100
    }
  });
  return /* @__PURE__ */ jsxs(AbsoluteFill, { style: {
    backgroundColor: "#000",
    overflow: "hidden"
  }, children: [
    montage_segments.map((segment, index) => {
      const segmentDuration = segment.end_frame - segment.start_frame;
      const imageIndex = index % imageUrls.length;
      return /* @__PURE__ */ jsx(
        Sequence,
        {
          from: segment.start_frame,
          durationInFrames: segmentDuration,
          children: /* @__PURE__ */ jsx(AbsoluteFill, { style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }, children: /* @__PURE__ */ jsx(
            Img,
            {
              src: imageUrls[imageIndex],
              style: {
                width: "100%",
                height: "100%",
                objectFit: "cover",
                ...getAnimationStyle(frame, segment, segmentDuration)
              }
            }
          ) })
        },
        index
      );
    }),
    subtitle && /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: subtitleOpacity,
          transform: `scale(${subtitleScale})`,
          zIndex: 10
        },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              padding: "16px 32px",
              borderRadius: 12,
              maxWidth: "80%",
              textAlign: "center"
            },
            children: /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  color: "#FFFFFF",
                  fontSize: 28,
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  fontWeight: 600,
                  letterSpacing: 2,
                  lineHeight: 1.5,
                  textShadow: "0 2px 4px rgba(0,0,0,0.3)"
                },
                children: subtitle
              }
            )
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)`,
          pointerEvents: "none",
          zIndex: 5
        }
      }
    )
  ] });
};
var comp_fast_montage_default = FastMontage;
export {
  comp_fast_montage_default as default
};
