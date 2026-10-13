import { ImageResponse } from "next/og";

export const alt = "Natu Mariel: productos Natura a precios especiales";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#fff7ef",
          color: "#3b1e4a",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", right: 90, top: 90, width: 180, height: 180, borderRadius: 999, background: "#ffd45c" }} />
        <div style={{ position: "absolute", right: 210, bottom: 70, width: 260, height: 260, borderRadius: 999, background: "#d1166b", opacity: 0.9 }} />
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700 }}>
          Natu&nbsp;<span style={{ color: "#d1166b" }}>Mariel</span>
        </div>
        <div style={{ fontSize: 40, marginTop: 24, maxWidth: 760 }}>Natura te encanta. Nuestros precios, todavía más.</div>
      </div>
    ),
    size,
  );
}
