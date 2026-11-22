import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CalendarClock, ListChecks, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { UstawieniaWyswietlania } from "@/components/layout/UstawieniaWyswietlania";
import { BrandMark, ServiceBar } from "@/components/layout/Brand";
import { DemoAccounts } from "@/components/auth/DemoAccounts";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoMode } from "@/lib/auth/demo";

export const metadata: Metadata = { title: "Logowanie – Kompas Kompetencji" };
// DEMO_MODE czytamy przy każdym żądaniu, nie w czasie budowania.
export const dynamic = "force-dynamic";

// Trzy wyróżniki na okładce – krótko, językiem przełożonego.
const HIGHLIGHTS = [
  { icon: CalendarClock, title: "Terminy liczone z przepisów", text: "art. 81 ustawy o służbie cywilnej, rozporządzenia, KC, święta i nieobecności" },
  { icon: ListChecks, title: "Ocena przez wybór zachowania", text: "opisy zachowań z modelu kompetencji i notatki z całego okresu" },
  { icon: BookOpenCheck, title: "Podstawa prawna przy każdym kroku", text: "„Dlaczego?” pokazuje przepis, z którego wynika wymóg" },
  { icon: ShieldCheck, title: "Sztuczna inteligencja tylko podpowiada", text: "decyduje przełożony, a każda decyzja trafia do dziennika" },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  const demo = isDemoMode();

  return (
    <div className="flex min-h-screen flex-col">
      <ServiceBar demo={demo} />
      {/* Kolumny zawijają się według szerokości w rem – także przy powiększonym tekście (przycisk „Dostępność”). */}
      <div className="flex flex-1 flex-wrap">
        <aside className="flex min-w-0 shrink grow basis-[min(100%,22rem)] flex-col gap-8 bg-[#173d70] px-6 py-10 text-white md:px-10 lg:py-14">
          <div className="flex flex-wrap items-center gap-3">
            <BrandMark size="lg" className="bg-white text-[#173d70]" />
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Kompas Kompetencji</h1>
          </div>
          <p className="max-w-md text-2xl leading-snug font-medium">Ocena oparta na zachowaniach, nie na wrażeniach.</p>
          <ul className="flex max-w-md flex-col gap-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-white/10" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-white/85">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-auto text-sm text-white/85">Pierwsza ocena i ocena okresowa członków korpusu służby cywilnej – od rozmowy do arkusza PDF.</p>
        </aside>

        <main className="flex min-w-0 shrink grow-[2] basis-[min(100%,30rem)] flex-col gap-8 px-6 py-10 md:px-10 lg:py-14">
          <div className="flex justify-end">
            <UstawieniaWyswietlania />
          </div>
          <section aria-labelledby="logowanie" className="flex w-full max-w-sm flex-col gap-4">
            <h2 id="logowanie" className="text-2xl">
              Zaloguj się
            </h2>
            <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />
          </section>
          {demo ? <DemoAccounts accounts={DEMO_ACCOUNTS} password={DEMO_PASSWORD} /> : null}
          <footer className="mt-auto text-sm text-muted-foreground">
            <Link href="/deklaracja-dostepnosci">Deklaracja dostępności</Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
