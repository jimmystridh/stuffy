import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { ThemeInit } from "@/components/theme-init";
import { AuthProvider } from "@/lib/firebase/auth-context";
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
  title: "Stuffy - Personal Inventory",
  description: "Personal inventory tracker",
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
          <NavBar />
          <main className="pb-16 md:pt-16">{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
