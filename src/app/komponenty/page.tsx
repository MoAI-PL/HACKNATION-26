import type { Metadata } from "next";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Showcase } from "./Showcase";

// Katalog komponentów bazowych (Z10) – podgląd dla zespołu i do kontroli dostępności.
// Dane są fikcyjne; ekran nie jest częścią ścieżki demo dla jury.

export const metadata: Metadata = { title: "Komponenty – Kompas Kompetencji" };

export default function KomponentyPage() {
  return (
    <AppShell user={{ name: "Ewa Kowalczyk", role: "PRZELOZONY" }}>
      <PageHeader
        title="Komponenty interfejsu"
        description="Wspólne elementy wszystkich ekranów. Zasady i przykłady użycia: docs/UX.md."
      />
      <Showcase />
    </AppShell>
  );
}
