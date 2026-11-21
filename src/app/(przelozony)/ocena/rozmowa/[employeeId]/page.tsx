import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/AppShell";
import { PrintButton } from "@/components/ui/print-button";
import { RozmowaAI } from "@/components/rozmowa/RozmowaAI";
import { buttonVariants } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Notice } from "@/components/ui/notice";
import { getFragment } from "@/lib/ai/rag/search";
import { requirePageRole } from "@/lib/auth/guard";
import { formatDatePl } from "@/lib/obserwacje/dziennik";
import { buildConversationPrep, CONVERSATION_LABELS, type ConversationKind, type IndicatorEvidence } from "@/lib/rozmowa/przygotowanie";
import { loadPrepData } from "@/lib/rozmowa/repo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Przygotowanie rozmowy – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Ściąga do rozmowy (Z24) – do przeczytania przed rozmową i do wydruku.

function Evidence({ items, empty }: { items: IndicatorEvidence[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((e) => (
        <li key={e.indicatorId} className="text-sm">
          <span className="font-medium">{e.name}</span>{" "}
          <span className="text-muted-foreground">
            ({e.competencyName}; {e.levelLabel}; {e.source === "OCENA" ? "z Twojej oceny wskaźnika" : `z ${e.observations.length} ${e.observations.length === 1 ? "notatki" : "notatek"}`})
          </span>
        </li>
      ))}
    </ul>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 print:break-inside-avoid print:border-0 print:p-0">
      <h2 id={id} className="text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function PrzygotowanieRozmowyPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ typ?: string }>;
}) {
  const user = await requirePageRole("PRZELOZONY");
  const { employeeId } = await params;
  const { typ } = await searchParams;
  const data = await loadPrepData(user.id, employeeId);
  if (!data) notFound();
  // Rodzaj z adresu tylko, jeśli dotyczy oceny tego pracownika (np. pierwsza ocena ma wyłącznie rozmowę wstępną).
  const kind: ConversationKind = data.allowed.includes(typ as ConversationKind) ? (typ as ConversationKind) : data.suggested;
  const prep = buildConversationPrep({ ...data.input, kind });
  const source = getFragment(prep.sourceFragmentId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={prep.title}
        description={data.input.positionTitle ?? undefined}
        action={
          <div className="flex gap-2 print:hidden">
            <Link href="/ocena/rozmowa" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
              Wszyscy podwładni
            </Link>
            <PrintButton />
          </div>
        }
      />

      {data.allowed.length > 1 && (
        <nav aria-label="Rodzaj rozmowy" className="flex flex-wrap gap-1 self-start rounded-lg border bg-card p-1 print:hidden">
          {data.allowed.map((k) => (
            <Link
              key={k}
              href={`/ocena/rozmowa/${encodeURIComponent(employeeId)}?typ=${k}`}
              aria-current={k === kind ? "page" : undefined}
              className={cn(buttonVariants({ variant: k === kind ? "secondary" : "ghost", size: "sm" }), "h-9 px-3")}
            >
              {CONVERSATION_LABELS[k]}
              {k === data.suggested && <span className="sr-only"> (następna według etapu oceny)</span>}
              {k === data.suggested && k !== kind && <span aria-hidden> •</span>}
            </Link>
          ))}
        </nav>
      )}

      <Section id="cel" title="Cel rozmowy">
        <p>{prep.goal}</p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Zakres rozmowy: {prep.legalBasis}
          {source && (
            <InfoTip legalBasis={prep.legalBasis} quote={source.text.length > 600 ? `${source.text.slice(0, 600)}…` : source.text}>
              Przepis określa, o czym trzeba porozmawiać.
            </InfoTip>
          )}
        </p>
        {prep.notes.map((n) => (
          <Notice key={n} tone="info" title={n} />
        ))}
      </Section>

      <Section id="agenda" title="Agenda">
        <ol className="flex list-decimal flex-col gap-3 pl-5">
          {prep.agenda.map((a) => (
            <li key={a.topic}>
              <span className="font-medium">{a.topic}</span>
              {a.details.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                  {a.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {kind === "OCENIAJACA" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Section id="mocne" title="Mocne strony">
            <Evidence items={prep.strengths} empty="Brak wskaźników na poziomie „powyżej oczekiwań” w ocenach i notatkach." />
          </Section>
          <Section id="rozwoj-obszary" title="Obszary do rozwoju">
            <Evidence items={prep.growth} empty="Brak wskaźników poniżej oczekiwań w ocenach i notatkach." />
          </Section>
        </div>
      )}

      <Section id="pytania" title="Pytania">
        <ol className="flex list-decimal flex-col gap-3 pl-5">
          {prep.questions.map((q) => (
            <li key={q.text}>
              {q.text}
              <span className="block text-xs text-muted-foreground">{q.why}</span>
            </li>
          ))}
        </ol>
      </Section>

      {prep.feedback.length > 0 && (
        <Section id="informacja-zwrotna" title="Informacja zwrotna (zachowanie – skutek – oczekiwanie)">
          <ul className="flex flex-col gap-4">
            {prep.feedback.map((f) => (
              <li key={`${f.indicatorName}-${f.date}`} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {f.indicatorName} <span className="font-normal text-muted-foreground">· {formatDatePl(f.date)}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Zachowanie: </span>
                  {f.behavior}
                </span>
                <span>
                  <span className="text-muted-foreground">Skutek: </span>
                  {f.effect}
                </span>
                <span>
                  <span className="text-muted-foreground">Oczekiwanie: </span>
                  {f.expectation}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {prep.development.length > 0 && (
        <Section id="dzialania-rozwojowe" title="Pomysły na działania rozwojowe">
          {prep.development.map((d) => (
            <div key={d.competency} className="text-sm">
              <p className="font-medium">{d.name}</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {d.ideas.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">To podpowiedzi do rozmowy. Uzgodnione działania wpiszesz do wniosków IPRZ w podsumowaniu oceny.</p>
        </Section>
      )}

      <Section id="trudne" title="Trudne sytuacje">
        <ul className="flex flex-col gap-3">
          {prep.difficult.map((d) => (
            <li key={d.situation} className="text-sm">
              <span className="font-medium">{d.situation}</span>
              <span className="block">{d.tip}</span>
              {d.legalBasis && <span className="block text-xs text-muted-foreground">Podstawa: {d.legalBasis}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="przed-rozmowa" title="Przed rozmową">
        <ul className="list-disc pl-5 text-sm">
          {prep.checklist.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>

      <RozmowaAI key={kind} employeeId={employeeId} kind={kind} />
    </div>
  );
}
