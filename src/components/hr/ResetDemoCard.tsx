"use client";
// Przycisk „Resetuj dane demo” z potwierdzeniem – przed pitchem i po testach jury przywraca stan początkowy.

import * as React from "react";
import { useFormStatus } from "react-dom";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { resetDemoAction } from "@/lib/demo/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} aria-live="polite">
      {pending ? "Przywracanie danych…" : "Resetuj dane"}
    </Button>
  );
}

export function ResetDemoCard() {
  const [open, setOpen] = React.useState(false);
  return (
    <section aria-labelledby="tryb-demo" className="flex flex-col gap-3 rounded-lg border border-dashed bg-card p-4">
      <div>
        <h2 id="tryb-demo" className="text-xl">
          Tryb demo
        </h2>
        <p className="text-sm text-muted-foreground">
          Przywraca przykładowe dane (pracownicy, oceny, obserwacje, przypomnienia) do stanu początkowego, z terminami liczonymi od dzisiaj. Konta logowania zostają.
          Widoczne tylko w trybie demo.
        </p>
      </div>
      <Button type="button" variant="outline" className="h-10 self-start" onClick={() => setOpen(true)}>
        <RotateCcw aria-hidden /> Resetuj dane demo
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Przywrócić dane demo?"
        description="Wszystkie zmiany wprowadzone w danych demo (oceny, notatki, przypomnienia) zostaną usunięte, a przykładowe dane utworzone od nowa. Tej operacji nie można cofnąć."
        footer={
          <form action={resetDemoAction} className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Zostaw
            </Button>
            <ConfirmButton />
          </form>
        }
      />
    </section>
  );
}
