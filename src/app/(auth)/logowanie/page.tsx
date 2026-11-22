import type { Metadata } from "next";
import { Compass } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { UstawieniaWyswietlania } from "@/components/layout/UstawieniaWyswietlania";
import { DemoAccounts } from "@/components/auth/DemoAccounts";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoMode } from "@/lib/auth/demo";

export const metadata: Metadata = { title: "Logowanie – Kompas Kompetencji" };
// DEMO_MODE czytamy przy każdym żądaniu, nie w czasie budowania.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  const demo = isDemoMode();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-primary">
            <Compass className="size-9" aria-hidden />
            <h1 className="text-3xl font-semibold tracking-tight">Kompas Kompetencji</h1>
          </div>
          <UstawieniaWyswietlania />
        </div>
        <p className="text-lg text-muted-foreground">Ocena oparta na zachowaniach, nie na wrażeniach.</p>
      </header>

      {/* Kolumny zawijają się według szerokości w rem – także przy powiększonym tekście (przycisk „Dostępność”). */}
      <div className={demo ? "flex flex-wrap items-start gap-10" : "max-w-sm"}>
        <section aria-labelledby="logowanie" className="flex max-w-sm min-w-0 flex-[1_1_17rem] flex-col gap-4">
          <h2 id="logowanie" className="text-lg font-medium">
            Zaloguj się
          </h2>
          <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />
        </section>
        {demo ? (
          <div className="min-w-0 flex-[2_1_22rem]">
            <DemoAccounts accounts={DEMO_ACCOUNTS} password={DEMO_PASSWORD} />
          </div>
        ) : null}
      </div>

      <footer className="text-sm text-muted-foreground">
        <Link href="/deklaracja-dostepnosci">Deklaracja dostępności</Link>
      </footer>
    </main>
  );
}
