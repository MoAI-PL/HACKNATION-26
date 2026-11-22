import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF arkuszy (Z16): @react-pdf/renderer działa jako pakiet Node (bez pakowania przez bundler),
  // a pliki czcionki Noto Sans muszą trafić do funkcji serwerowej endpointu (Vercel).
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    // pdfkit (silnik @react-pdf) wczytuje wbudowane czcionki dynamicznie (require po nazwie), więc śledzenie plików
    // Vercela ich nie widzi – bez tych wpisów funkcja kończy się błędem „Cannot find module …/standard-fonts/Helvetica.cjs”.
    "/api/v1/oceny/[id]/pdf": ["./src/lib/pdf/czcionki/**", "./node_modules/pdfkit/js/standard-fonts/**", "./node_modules/pdfkit/js/data/**"],
  },
};

export default nextConfig;
