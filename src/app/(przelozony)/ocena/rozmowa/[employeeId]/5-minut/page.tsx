import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ListChecks, MessageCircleQuestion, Quote } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { buildConversationPrep, CONVERSATION_LABELS, type ConversationKind } from "@/lib/rozmowa/przygotowanie";
import { buildFiveMinuteBrief } from "@/lib/rozmowa/piec-minut";
import { loadPrepData } from "@/lib/rozmowa/repo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "5 minut przed rozmową – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Tryb „5 minut przed rozmową” (Z39): jedna strona – fakty, trzy pytania, trzy pułapki. Pełna ściąga: Z24, przebieg: Z43.

function Block({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 print:break-inside-avoid print:border-0 print:p-0">
      <h2 id={id} className="flex items-center gap-2 text-lg">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function PiecMinutPrzedRozmowaPage({
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
  // Ta sama reguła co na ściądze: rodzaj z adresu tylko, jeśli dotyczy oceny tego pracownika.
  const kind: ConversationKind = data.allowed.includes(typ as ConversationKind) ? (typ as ConversationKind) : data.suggested;
  const input = { ...data.input, kind };
  const brief = buildFiveMinuteBrief(input, buildConversationPrep(input), todayIso());
  const base = `/ocena/rozmowa/${encodeURIComponent(employeeId)}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader
        title={brief.title}
        description={`${CONVERSATION_LABELS[kind]}. ${brief.goal}`}
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link href={`${base}?typ=${kind}`} className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
              Pełna ściąga
            </Link>
            <PrintButton />
            <Link href={`${base}/tryb?typ=${kind}`} className={cn(buttonVariants(), "h-10")}>
              Zacznij rozmowę
            </Link>
          </div>
        }
      />

      {data.allowed.length > 1 && (
        <nav aria-label="Rodzaj rozmowy" className="flex flex-wrap gap-1 self-start rounded-lg border bg-card p-1 print:hidden">
          {data.allowed.map((k) => (
            <Link
              key={k}
              href={`${base}/5-minut?typ=${k}`}
              aria-current={k === kind ? "page" : undefined}
              className={cn(buttonVariants({ variant: k === kind ? "secondary" : "ghost", size: "sm" }), "h-9 px-3")}
            >
              {CONVERSATION_LABELS[k]}
            </Link>
          ))}
        </nav>
      )}

      <Block id="fakty" title="Najważniejsze fakty" icon={<ListChecks className="size-5 text-primary" aria-hidden />}>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {brief.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Block>

      <Block id="otwarcie" title="Zacznij od" icon={<Quote className="size-5 text-primary" aria-hidden />}>
        <p className="border-l-4 border-primary pl-3 italic">„{brief.opening}”</p>
      </Block>

      <Block id="pytania" title="Trzy pytania" icon={<MessageCircleQuestion className="size-5 text-primary" aria-hidden />}>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {brief.questions.map((q) => (
            <li key={q.text}>
              {q.text}
              <span className="block text-xs text-muted-foreground">{q.why}</span>
            </li>
          ))}
        </ol>
      </Block>

      <Block id="pulapki" title="Uważaj na" icon={<AlertTriangle className="size-5 text-warning" aria-hidden />}>
        <ul className="flex flex-col gap-3">
          {brief.pitfalls.map((p) => (
            <li key={p.title} className="text-sm">
              <span className="font-medium">{p.title}</span>
              <span className="block">{p.tip}</span>
              {p.legalBasis && <span className="block text-xs text-muted-foreground">Podstawa: {p.legalBasis}</span>}
            </li>
          ))}
        </ul>
      </Block>
    </div>
  );
}
