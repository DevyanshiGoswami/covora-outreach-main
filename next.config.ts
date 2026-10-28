import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Action arguments include invitation secrets; never log them, even locally.
  logging: { serverFunctions: false },
};

export default nextConfig;
