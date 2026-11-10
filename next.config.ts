import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // Standalone output for the Docker image (see Dockerfile).
  output: 'standalone',
};

export default nextConfig;
