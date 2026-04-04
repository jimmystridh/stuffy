import { ImageResponse } from "next/og";
import { PWA_COLORS } from "@/lib/pwa";

const iconVariants = {
  apple: 180,
  "192": 192,
  "512": 512,
} as const;

function getIconSize(variant: string) {
  return iconVariants[variant as keyof typeof iconVariants] ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> },
) {
  const { variant } = await params;
  const size = getIconSize(variant);

  if (!size) {
    return new Response("Not found", { status: 404 });
  }

  const shellRadius = Math.round(size * 0.23);
  const insetRadius = Math.round(size * 0.18);
  const panelSize = Math.round(size * 0.58);
  const panelRadius = Math.round(size * 0.16);
  const glyphSize = Math.round(size * 0.38);
  const shadowBlur = Math.round(size * 0.12);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: shellRadius,
          background: `linear-gradient(135deg, ${PWA_COLORS.iconStart} 0%, ${PWA_COLORS.iconEnd} 100%)`,
          padding: Math.round(size * 0.08),
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: insetRadius,
            background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)",
          }}
        >
          <div
            style={{
              width: panelSize,
              height: panelSize,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: panelRadius,
              background: PWA_COLORS.iconPanel,
              boxShadow: `0 ${Math.round(size * 0.03)}px ${shadowBlur}px rgba(76, 29, 149, 0.35)`,
            }}
          >
            <div
              style={{
                width: Math.round(panelSize * 0.72),
                height: Math.round(panelSize * 0.72),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: Math.round(panelSize * 0.2),
                background: `linear-gradient(180deg, ${PWA_COLORS.iconGlyphStart} 0%, ${PWA_COLORS.iconGlyphEnd} 100%)`,
                color: "#ffffff",
                fontSize: glyphSize,
                fontWeight: 800,
                letterSpacing: "-0.08em",
              }}
            >
              S
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
