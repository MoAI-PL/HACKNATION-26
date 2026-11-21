import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
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
        <div className="flex items-center gap-3 text-primary">
          <Compass className="size-9" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight">Kompas Kompetencji</h1>
        </div>
        <p className="text-lg text-muted-foreground">Ocena oparta na zachowaniach, nie na wrażeniach.</p>
      </header>

      <div className={demo ? "grid gap-10 md:grid-cols-[minmax(0,22rem)_1fr]" : "max-w-sm"}>
        <section aria-labelledby="logowanie" className="flex flex-col gap-4">
          <h2 id="logowanie" className="text-lg font-medium">
            Zaloguj się
          </h2>
          <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />
        </section>
        {demo ? <DemoAccounts accounts={DEMO_ACCOUNTS} password={DEMO_PASSWORD} /> : null}
      </div>
    </main>
  );
}
