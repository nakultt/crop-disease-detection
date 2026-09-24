import { ImageResponse } from "next/og";
import { BRAND_GOLD, LeafMark } from "./lib/brand-image";

export const alt = "PlantGuard — spot crop disease early, and see the evidence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card shown when a PlantGuard link is shared. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: "#f1f6f0",
        background:
          "radial-gradient(circle at 92% 8%, rgba(220,163,17,0.35) 0%, rgba(220,163,17,0) 42%), linear-gradient(135deg, #1f5a47 0%, #15402f 55%, #0e2c22 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.12)",
          }}
        >
          <LeafMark size={46} />
        </div>
        <div style={{ fontSize: 40, fontWeight: 700 }}>PlantGuard</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          Spot crop disease early — and see the evidence.
        </div>
        <div style={{ fontSize: 30, color: "rgba(241,246,240,0.82)" }}>
          A leaf photo in, a diagnosis in under a second.
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {["38 conditions", "14 crops", "8 languages"].map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 22px",
              borderRadius: 999,
              fontSize: 26,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 12,
                background: BRAND_GOLD,
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
