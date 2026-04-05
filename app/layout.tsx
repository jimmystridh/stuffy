import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { PwaRegistration } from "@/components/pwa-registration";
import { ThemeInit } from "@/components/theme-init";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, PWA_COLORS, PWA_ICONS } from "@/lib/pwa";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: "Stuffy - Personal Inventory",
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    shortcut: "/favicon.ico",
    icon: [
      {
        url: PWA_ICONS.icon192.url,
        sizes: PWA_ICONS.icon192.sizes,
        type: PWA_ICONS.icon192.type,
      },
      {
        url: PWA_ICONS.icon512.url,
        sizes: PWA_ICONS.icon512.sizes,
        type: PWA_ICONS.icon512.type,
      },
    ],
    apple: [
      {
        url: PWA_ICONS.apple.url,
        sizes: PWA_ICONS.apple.sizes,
        type: PWA_ICONS.apple.type,
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PWA_COLORS.lightTheme },
    { media: "(prefers-color-scheme: dark)", color: PWA_COLORS.darkTheme },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-full flex flex-col`}
      >
        <AuthProvider>
          <ThemeInit />
          <PwaRegistration />
          <NavBar />
          <main className="pb-16 md:pt-16">{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
