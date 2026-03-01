import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@deeppling/shared", "@deeppling/agent", "@deeppling/worker"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
