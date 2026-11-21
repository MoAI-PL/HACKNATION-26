"use client";

import * as React from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Nieoczekiwany błąd ekranu – komunikat po polsku zamiast domyślnego ekranu Next.js.
// Szczegóły błędu zostają w logach serwera; użytkownik widzi tylko numer zgłoszenia (digest) do przekazania.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <TriangleAlert className="size-10 text-warning" aria-hidden />
      <h1 className="text-2xl font-semibold">Coś poszło nie tak</h1>
      <p className="text-muted-foreground">
        Nie udało się wyświetlić tego ekranu. Twoje zapisane dane są bezpieczne – spróbuj ponownie za chwilę.
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Numer zgłoszenia: {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Spróbuj ponownie</Button>
        <Button asChild variant="outline">
          <Link href="/">Ekran startowy</Link>
        </Button>
      </div>
    </main>
  );
}
