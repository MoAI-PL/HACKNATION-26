"use client";

import * as React from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineBadge, EvaluationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip, Term } from "@/components/ui/info-tip";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ChoiceCardGroup, ChoiceCardMulti } from "@/components/ui/choice-cards";
import { WizardFooter, WizardProgress } from "@/components/ui/wizard";
import { PropozycjaAI, type ProposalState } from "@/components/asystent/PropozycjaAI";
import { useShortcut, useShortcutEvent, dispatchShortcut } from "@/components/layout/useShortcut";
import { SHORTCUT_EVENTS } from "@/lib/ui/shortcuts";
import { urgencyFromDaysLeft, type AutosaveState } from "@/lib/ui/status";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import type { CompetencyCode } from "@/lib/domain/types";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

const ZACHOWANIA = [
  "Nie przekazuje informacji albo przekazuje je z opóźnieniem, przez co inni nie mogą wykonać zadań.",
  "Przekazuje informacje niepełne; współpracownicy muszą o nie dopytywać.",
  "Przekazuje potrzebne informacje na czas i w zrozumiały sposób.",
  "Sam sprawdza, czego potrzebują inni, i dopasowuje informację do odbiorcy.",
  "Tworzy w zespole stałe sposoby dzielenia się informacją, z których korzystają inni.",
];

const DODATKOWE: CompetencyCode[] = ["ANALITYCZNE", "NEGOCJOWANIE", "WYSTAPIENIA", "KRYZYS", "KLIENT", "KREATYWNOSC"];

export function Showcase() {
  const [step, setStep] = React.useState(3);
  const [autosave, setAutosave] = React.useState<AutosaveState>({ status: "saved", at: new Date() });
  const [poziom, setPoziom] = React.useState<string | undefined>("3");
  const [kryteria, setKryteria] = React.useState<CompetencyCode[]>(["ANALITYCZNE"]);
  const [uzasadnienie, setUzasadnienie] = React.useState("");
  const [stan, setStan] = React.useState<ProposalState>("gotowa");
  const [ostatniSkrot, setOstatniSkrot] = React.useState("—");

  // Skróty lokalne ekranu oceny (Z14) – przykład użycia useShortcut.
  useShortcut("1", () => setPoziom("1"));
  useShortcut("2", () => setPoziom("2"));
  useShortcut("3", () => setPoziom("3"));
  useShortcut("4", () => setPoziom("4"));
  useShortcut("5", () => setPoziom("5"));
  useShortcutEvent(SHORTCUT_EVENTS.quickNote, () => setOstatniSkrot("N – szybka notatka (otworzy ją Z41)"));
  useShortcutEvent(SHORTCUT_EVENTS.assistant, () => setOstatniSkrot("/ – asystent formalny (otworzy go Z22)"));

  const zmienPole = (v: string) => {
    setUzasadnienie(v);
    setAutosave({ status: "saving" });
    window.setTimeout(() => setAutosave({ status: "saved", at: new Date() }), 600);
  };

  return (
    <div className="flex flex-col gap-12">
      <Section id="przyciski" title="Przyciski i odznaki">
        <div className="flex flex-wrap gap-2">
          <Button>Dalej: wybór kryteriów</Button>
          <Button variant="outline">Wstecz</Button>
          <Button variant="ghost">Anuluj</Button>
          <Button variant="link">Zobacz arkusz</Button>
          <Button variant="destructive">Usuń notatkę</Button>
          <Button variant="ai">Wstaw</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {[-3, 0, 5, 21, 60].map((d) => (
            <DeadlineBadge key={d} daysLeft={d} urgency={urgencyFromDaysLeft(d)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <EvaluationStatusBadge type="OKRESOWA" status="DO_ROZPOCZECIA" />
          <EvaluationStatusBadge type="OKRESOWA" status="W_OKRESIE_OCENY" />
          <EvaluationStatusBadge type="OKRESOWA" status="W_OCENIE" />
          <EvaluationStatusBadge type="PIERWSZA" status="W_OKRESIE_OCENY" />
          <EvaluationStatusBadge type="OKRESOWA" status="CZEKA_NA_ZAPOZNANIE" />
          <EvaluationStatusBadge type="OKRESOWA" status="ZAKONCZONA" />
          <StatusBadge tone="ai">Sugestia systemu</StatusBadge>
        </div>
      </Section>

      <Section id="karty" title="Karta „Do zrobienia” (wzór dla pulpitu Z11)">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Do zrobienia</CardTitle>
            <CardDescription>Najpilniejsze sprawy na dziś.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {[
              { t: "Rozmowa rozpoczynająca z J. Nowakiem – do piątku 28.11 (§ 5)", d: 5, a: "Przygotuj rozmowę" },
              { t: "Ocena okresowa A. Wiśniewskiej – do 15.12", d: 21, a: "Rozpocznij ocenę" },
              { t: "Ponowna ocena P. Zielińskiego po ocenie negatywnej", d: -2, a: "Otwórz ocenę" },
            ].map((x) => (
              <div key={x.t} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-col gap-1">
                  <span>{x.t}</span>
                  <DeadlineBadge daysLeft={x.d} urgency={urgencyFromDaysLeft(x.d)} className="self-start" />
                </div>
                <Button variant="outline">{x.a}</Button>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <span className="text-sm text-muted-foreground">Terminy liczone według rozporządzenia i Kodeksu cywilnego.</span>
          </CardFooter>
        </Card>
      </Section>

      <Section id="kreator" title="Kreator z paskiem postępu i autozapisem">
        <Card>
          <CardContent className="flex flex-col gap-6 pt-5">
            <WizardProgress
              steps={["Opis stanowiska", "Arkusz", "Kryteria", "Rozmowa rozpoczynająca", "Ocena wskaźników", "Podsumowanie"]}
              current={step}
              onStepClick={setStep}
            />
            <Field
              label="Uzasadnienie oceny"
              hint="Opisz konkretne zachowania z okresu oceny – sytuację, działanie i rezultat."
              aside={
                <InfoTip legalBasis="§ 11 ust. 3 rozporządzenia o ocenach okresowych">
                  Uzasadnienie jest obowiązkowe, gdy ocena jest negatywna. Przy ocenie pozytywnej możesz je dodać.
                </InfoTip>
              }
            >
              <Textarea value={uzasadnienie} onChange={(e) => zmienPole(e.target.value)} />
            </Field>
            <WizardFooter
              autosave={autosave}
              back={
                <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  Wstecz
                </Button>
              }
              primary={<Button onClick={() => setStep((s) => Math.min(6, s + 1))}>Dalej: rozmowa rozpoczynająca</Button>}
            />
          </CardContent>
        </Card>
      </Section>

      <Section id="wybor" title="Wybór kartami (karty zachowań, kryteria dodatkowe)">
        <p className="text-sm text-muted-foreground">
          Komunikacja → wskaźnik 1. Wybierz myszą albo klawiszami <kbd className="rounded border bg-muted px-1">1</kbd>–
          <kbd className="rounded border bg-muted px-1">5</kbd>.
        </p>
        <ChoiceCardGroup
          label="Opis zachowania najbliższy temu, co obserwowałeś"
          columns={5}
          value={poziom}
          onValueChange={setPoziom}
          options={[
            ...ZACHOWANIA.map((z, i) => ({ value: String(i + 1), label: z, hint: `Klawisz ${i + 1}` })),
          ]}
        />
        <Button variant="link" className="self-start px-0" onClick={() => setPoziom("BRAK")}>
          Brak okazji do obserwacji
        </Button>
        <ChoiceCardMulti
          label="Kryteria dodatkowe"
          max={3}
          maxReachedText="Możesz wybrać najwyżej 3 kryteria dodatkowe (§ 5 ust. 2)."
          columns={3}
          values={kryteria}
          onValuesChange={setKryteria}
          options={DODATKOWE.map((k) => ({ value: k, label: COMPETENCY_NAMES[k] }))}
        />
      </Section>

      <Section id="ai" title="Propozycja AI">
        <div className="flex flex-wrap gap-2">
          {(["gotowa", "ladowanie", "niedostepna"] as ProposalState[]).map((s) => (
            <Button key={s} variant={stan === s ? "secondary" : "ghost"} onClick={() => setStan(s)}>
              Stan: {s}
            </Button>
          ))}
        </div>
        <PropozycjaAI
          state={stan}
          title="Uzasadnienie oceny"
          proposal="W okresie oceny dwukrotnie przekazał materiały na posiedzenie Komisji po terminie, bez wcześniejszej informacji. Po rozmowie we wrześniu terminy były dotrzymywane."
          sources={[{ document: "Rozporządzenie o ocenach okresowych", unit: "§ 11 ust. 3", quote: "Oceniający sporządza uzasadnienie przyznanej oceny w przypadku przyznania oceny negatywnej." }]}
          onInsert={(t) => setUzasadnienie(t)}
          onReject={() => undefined}
          onCancel={() => setStan("niedostepna")}
          onRetry={() => setStan("gotowa")}
        />
      </Section>

      <Section id="komunikaty" title="Komunikaty, puste stany, pola">
        <Notice tone="error" title="Ocena jest negatywna, bo jedna ocena cząstkowa wynosi 1 pkt." legalBasis="§ 11 ust. 1 pkt 4">
          Uzasadnienie jest wtedy obowiązkowe. Uzupełnij je w kroku „Podsumowanie”.
        </Notice>
        <Notice tone="warning" title="Większość notatek pochodzi z ostatniego miesiąca.">
          Sprawdź, czy ocena obejmuje cały okres – to nie blokuje zamknięcia oceny.
        </Notice>
        <Notice tone="success" title="Arkusz zapisany i gotowy do podpisu." />
        <EmptyState
          icon={NotebookPen}
          title="Nie masz jeszcze obserwacji."
          description={
            <>
              Naciśnij <kbd className="rounded border bg-muted px-1">N</kbd>, żeby dodać pierwszą w 10 sekund.
            </>
          }
          action={<Button onClick={() => dispatchShortcut(SHORTCUT_EVENTS.quickNote)}>Dodaj obserwację</Button>}
        />
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Data rozmowy" hint="dd.mm.rrrr" required>
            <Input type="date" />
          </Field>
          <Field label="Imię i nazwisko" error="Wpisz imię i nazwisko pracownika.">
            <Input defaultValue="" />
          </Field>
        </div>
        <p>
          Terminy z dymkiem: <Term>OSP</Term>, <Term>IPRZ</Term>, <Term>ocena cząstkowa</Term>.
        </p>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Ostatni skrót: {ostatniSkrot}
        </p>
      </Section>
    </div>
  );
}
