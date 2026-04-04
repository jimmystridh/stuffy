import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/stuffy-uploads/**",
      },
    ],
  },
  serverExternalPackages: ["sharp", "@modelcontextprotocol/sdk"],
};

export default nextConfig;
