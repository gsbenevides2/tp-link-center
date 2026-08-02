import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  logging: {
    incomingRequests: true,
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
    serverFunctions: true,
  },
};

export default nextConfig;
