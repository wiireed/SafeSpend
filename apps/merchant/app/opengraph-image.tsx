/// Auto-generated OG share image. Next.js renders this to a PNG at
/// build time and wires up the og:image meta tag for every page that
/// inherits this layout. Result: when the demo URL is shared in
/// Slack / Discord / Twitter / iMessage, the link preview shows the
/// branded image instead of nothing.
///
/// File-based magic: any opengraph-image.{tsx,jpg,png,gif,svg} in an
/// app router segment becomes the og:image for that segment.

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SafeSpend — programmable wallet safety for AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #050807 0%, #0a0a0a 50%, #0a1410 100%)",
          color: "#e5e5e5",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          padding: "80px",
        }}
      >
        {/* badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 20px",
            borderRadius: "9999px",
            background: "rgba(6, 78, 59, 0.4)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            color: "#6ee7b7",
            fontSize: "20px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
              background: "#10b981",
            }}
          />
          Live on Avalanche Fuji · safespend.eth
        </div>

        {/* title */}
        <div
          style={{
            display: "flex",
            fontSize: "92px",
            fontWeight: 700,
            color: "#fafafa",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            marginBottom: "24px",
          }}
        >
          SafeSpend
        </div>

        {/* tagline */}
        <div
          style={{
            display: "flex",
            fontSize: "36px",
            color: "#10b981",
            fontWeight: 500,
            marginBottom: "32px",
          }}
        >
          The agent can be tricked.&nbsp;
          <span style={{ color: "#a3a3a3" }}>The wallet cannot.</span>
        </div>

        {/* description */}
        <div
          style={{
            display: "flex",
            fontSize: "26px",
            color: "#a3a3a3",
            textAlign: "center",
            maxWidth: "900px",
            lineHeight: 1.4,
          }}
        >
          Programmable spending policies for autonomous AI agents.
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: "60px",
            left: "80px",
            right: "80px",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#525252",
            fontSize: "20px",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          <div style={{ display: "flex" }}>safespend.eth</div>
          <div style={{ display: "flex" }}>Web3NZ Hackathon · 2026</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
