import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hand proxy.ts the exact internal request URL so host-based rewrites built
  // from req.url resolve as internal rewrites (not self-proxying) in standalone
  // mode, whatever HOSTNAME the server binds to and whatever scheme Caddy forwards.
  skipProxyUrlNormalize: true,
  experimental: {
    // Image uploads go through server actions; lib/storage.ts enforces the 5 MB rule.
    serverActions: { bodySizeLimit: "6mb" },
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "bcryptjs"],
  images: {
    // Lodge images are served from the object store (MinIO/S3) or the local dev bucket.
    remotePatterns: [{ protocol: "http", hostname: "**" }, { protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
