import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, PWA_COLORS, PWA_ICONS } from "@/lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PWA_COLORS.background,
    theme_color: PWA_COLORS.lightTheme,
    icons: [
      {
        src: PWA_ICONS.icon192.url,
        sizes: PWA_ICONS.icon192.sizes,
        type: PWA_ICONS.icon192.type,
      },
      {
        src: PWA_ICONS.icon512.url,
        sizes: PWA_ICONS.icon512.sizes,
        type: PWA_ICONS.icon512.type,
      },
      {
        src: PWA_ICONS.apple.url,
        sizes: PWA_ICONS.apple.sizes,
        type: PWA_ICONS.apple.type,
      },
    ],
  };
}
