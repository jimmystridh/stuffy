import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/stuffy-uploads/**",
      },
    ],
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
