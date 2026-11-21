import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF arkuszy (Z16): @react-pdf/renderer działa jako pakiet Node (bez pakowania przez bundler),
  // a pliki czcionki Noto Sans muszą trafić do funkcji serwerowej endpointu (Vercel).
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/v1/oceny/[id]/pdf": ["./src/lib/pdf/czcionki/**"],
  },
};

export default nextConfig;
