export const APP_NAME = "Stuffy";
export const APP_SHORT_NAME = "Stuffy";
export const APP_DESCRIPTION = "Personal inventory tracker";

export const PWA_COLORS = {
  background: "#ffffff",
  lightTheme: "#faf5ff",
  darkTheme: "#0f172a",
  iconStart: "#7c3aed",
  iconEnd: "#ec4899",
  iconPanel: "#ffffff",
  iconGlyphStart: "#111827",
  iconGlyphEnd: "#334155",
} as const;

export const PWA_ICONS = {
  apple: {
    url: "/pwa-icon/apple",
    sizes: "180x180",
    type: "image/png",
  },
  icon192: {
    url: "/pwa-icon/192",
    sizes: "192x192",
    type: "image/png",
  },
  icon512: {
    url: "/pwa-icon/512",
    sizes: "512x512",
    type: "image/png",
  },
} as const;
