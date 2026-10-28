import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shared and problems ship raw TS, so Next has to compile them
  transpilePackages: ["@rehearse/shared", "@rehearse/problems"],
};

export default nextConfig;
