"use client";
// Zmiany przepisów i modelu z panelu HR w przeglądarce: kreator, ocena wskaźników i podsumowanie liczą
// na żywo tymi samymi funkcjami co serwer, więc dostają te same parametry. Stosujemy je przed wyrenderowaniem
// dzieci (render rodzica poprzedza render dzieci), idempotentnie po znaczniku wersji.

import { applyRuntimeConfig, type RuntimeConfig } from "@/lib/konfiguracja/stan";

export function ZastosujKonfiguracje({ config, children }: { config: RuntimeConfig; children: React.ReactNode }) {
  applyRuntimeConfig(config);
  return <>{children}</>;
}
