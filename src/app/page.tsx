import { Compass, ClipboardCheck, UserPlus } from "lucide-react";

// Strona startowa szkieletu (Z02). Docelowy układ i nawigację buduje Z10, pulpit – Z11.
const sciezki = [
  {
    ikona: UserPlus,
    tytul: "Pierwsza ocena w służbie cywilnej",
    kroki: [
      "Rozpocznij ocenę",
      "Zakończ ocenę z modelem kompetencji",
      "Asystent formalny oceny",
      "Asystent rozmowy",
    ],
  },
  {
    ikona: ClipboardCheck,
    tytul: "Ocena okresowa w służbie cywilnej",
    kroki: [
      "Analiza opisu stanowiska pracy",
      "Wybór arkusza B lub C, rozpoczęcie i zakończenie oceny",
      "Asystent formalny oceny",
      "Asystent rozmowy",
    ],
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-primary">
          <Compass className="size-9" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight">
            Kompas Kompetencji
          </h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Ocena oparta na zachowaniach, nie na wrażeniach.
        </p>
      </header>

      <section aria-labelledby="sciezki" className="flex flex-col gap-4">
        <h2 id="sciezki" className="text-xl font-medium">
          Dwie ścieżki oceny
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sciezki.map(({ ikona: Ikona, tytul, kroki }) => (
            <article
              key={tytul}
              className="flex flex-col gap-3 rounded-xl border bg-card p-6 text-card-foreground"
            >
              <div className="flex items-center gap-2">
                <Ikona className="size-5 text-primary" aria-hidden />
                <h3 className="font-medium">{tytul}</h3>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {kroki.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Aplikacja w budowie – HackNation 2026.
      </p>
    </main>
  );
}
