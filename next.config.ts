import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile in a parent directory otherwise
  // makes Turbopack guess wrong about where the project starts.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
