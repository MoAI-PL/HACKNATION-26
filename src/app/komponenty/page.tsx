import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell, PageHeader, shellUser } from "@/components/layout/AppShell";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { requirePageRole } from "@/lib/auth/guard";
import { isDemoMode } from "@/lib/auth/demo";
import { Showcase } from "./Showcase";

// Katalog komponentów bazowych – podgląd dla zespołu i do kontroli dostępności.
// Dane są fikcyjne; ekran nie jest częścią ścieżki demo dla jury.
// Na produkcji dostępny tylko w trybie demo; menu i nagłówek – zalogowanego użytkownika (jego rola).

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Komponenty – Kompas Kompetencji" };

export default async function KomponentyPage() {
  if (process.env.NODE_ENV === "production" && !isDemoMode()) notFound();
  const user = await requirePageRole("PRZELOZONY", "HR", "KIERUJACY_KOMORKA", "OCENIANY");
  return (
    <AppShell user={shellUser(user)} userMenu={<LogoutButton />}>
      <PageHeader
        title="Komponenty interfejsu"
        description="Wspólne elementy wszystkich ekranów. Zasady i przykłady użycia: docs/UX.md."
      />
      <Showcase />
    </AppShell>
  );
}
