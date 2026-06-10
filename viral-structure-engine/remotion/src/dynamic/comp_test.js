// src/dynamic/comp_test.tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { jsx } from "react/jsx-runtime";
var TestComponent = ({ text = "Hello", bgColor = "#1a1a2e", accentColor = "#e94560" }) => {
  const frame = useCurrentFrame();
  const rotation = interpolate(frame, [0, 60], [0, 360]);
  const opacity = interpolate(frame, [0, 20, 40, 60], [0, 1, 1, 0]);
  return /* @__PURE__ */ jsx(
    AbsoluteFill,
    {
      style: {
        background: `linear-gradient(135deg, ${bgColor}, ${accentColor})`,
        justifyContent: "center",
        alignItems: "center"
      },
      children: /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            color: "#fff",
            fontSize: 72,
            fontWeight: 700,
            transform: `rotate(${rotation}deg)`,
            opacity
          },
          children: text
        }
      )
    }
  );
};
var comp_test_default = TestComponent;
export {
  comp_test_default as default
};
