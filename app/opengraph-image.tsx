import { ImageResponse } from "next/og";

export const alt = "Vurlo: Short links that do more";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800, display: "flex" }}>
          Vurlo<span style={{ color: "#f97316" }}>.</span>
        </div>
        <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.05, display: "flex" }}>
          Short links that do more.
        </div>
        <div style={{ fontSize: 32, color: "#fbd3ae", display: "flex" }}>
          Shorten. Manage. Understand.
        </div>
      </div>
    ),
    size,
  );
}
