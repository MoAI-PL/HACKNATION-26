"use client";
// Karty kont demo na ekranie logowania (Z04, sekcja 4.3). Renderowane tylko przy DEMO_MODE=true.
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { demoLoginAction } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/domain/slownik";
import type { DemoAccount } from "@/lib/auth/demo";

export function DemoAccounts({ accounts, password }: { accounts: readonly DemoAccount[]; password: string }) {
  const [state, action, pending] = useActionState(demoLoginAction, undefined);

  return (
    <section aria-labelledby="konta-demo" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="konta-demo" className="text-lg font-medium">
          Konta demo
        </h2>
        <p className="text-sm text-muted-foreground">
          Dane są fikcyjne. Kliknij konto, żeby się zalogować. Ręcznie: e-mail z karty i hasło{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{password}</code>.
        </p>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3">
        {accounts.map((a) => (
          <li key={a.email}>
            <form action={action} className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4">
              <input type="hidden" name="email" value={a.email} />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-primary">
                  {ROLE_LABELS[a.role]}
                </span>
                <span className="font-medium">{a.name}</span>
                <span className="text-sm text-muted-foreground">{a.description}</span>
                <span className="break-all font-mono text-xs text-muted-foreground">{a.email}</span>
              </div>
              <Button type="submit" variant="outline" className="mt-auto h-auto min-h-9 whitespace-normal py-2 text-center" disabled={pending}>
                Zaloguj jako {a.name}
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {state?.error}
      </p>
    </section>
  );
}
