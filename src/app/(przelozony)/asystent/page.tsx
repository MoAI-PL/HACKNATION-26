import type { Metadata } from "next";
import { AsystentFormalny } from "@/components/asystent/AsystentFormalny";

export const metadata: Metadata = { title: "Asystent formalny – Kompas Kompetencji" };

// Strona asystenta formalnego (Z22). Nawigację i układ ról dokłada Z10/Z04.
export default async function AsystentPage({ searchParams }: { searchParams: Promise<{ krok?: string }> }) {
  const { krok } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asystent formalny oceny</h1>
        <p className="mt-1 text-muted-foreground">Procedura, formularze i terminy – odpowiedzi ze wskazaniem przepisu.</p>
      </div>
      <AsystentFormalny krok={krok} />
    </main>
  );
}
