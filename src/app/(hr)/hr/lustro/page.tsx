import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { Notice } from "@/components/ui/notice";
import { requirePageRole } from "@/lib/auth/guard";
import { rules } from "@/lib/domain/przepisy";
import { LEVEL_LABELS, RESULT_LABELS } from "@/lib/domain/slownik";
import { LEVELS, RESULTS } from "@/lib/domain/types";
import { loadCompletedForMirror } from "@/lib/ocena/dane-lustra";
import { unitMirror } from "@/lib/rules/lustro";
import { formatPoints, plural } from "@/lib/rules/tekst";

export const metadata: Metadata = { title: "Lustro ocen – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Panel HR „Lustro ocen” (Z36): zanonimizowany rozkład ocen w komórkach i przełożeni odstający od średniej komórki.
export default async function LustroOcenPage() {
  await requirePageRole("HR");
  const units = unitMirror(await loadCompletedForMirror());
  const min = rules.mirror.leniencyMinEvaluationsInUnit;

  return (
    <>
      <PageHeader
        title="Lustro ocen"
        description={`Rozkład sporządzonych ocen okresowych w komórkach – bez nazwisk ocenianych. Rozkład pokazujemy od ${min} ocen w komórce, żeby nie dało się rozpoznać osób.`}
      />
      {units.length === 0 ? (
        <EmptyState icon={Scale} title="Brak sporządzonych ocen" description="Rozkład pojawi się, gdy przełożeni sporządzą pierwsze oceny okresowe." />
      ) : (
        <ul className="flex flex-col gap-4">
          {units.map((u) => (
            <li key={u.unitId}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {u.unitName} <span className="font-normal text-muted-foreground">· {u.count} {plural(u.count, ["ocena", "oceny", "ocen"])}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {u.average === null ? (
                    <p className="text-sm text-muted-foreground">Za mało ocen, by pokazać rozkład bez ryzyka rozpoznania osób (wymagane co najmniej {min}).</p>
                  ) : (
                    <>
                      <p className="text-sm">
                        Średnia w komórce: <strong>{formatPoints(u.average)} pkt</strong> · {RESULTS.map((r) => `${RESULT_LABELS[r]}: ${u.results![r]}`).join(" · ")}
                      </p>
                      <table className="w-full max-w-xl text-left text-sm">
                        <caption className="sr-only">Rozkład poziomów ogólnych w komórce {u.unitName}</caption>
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th scope="col" className="py-1 pr-3 font-medium">Poziom ogólny</th>
                            <th scope="col" className="py-1 font-medium">Liczba ocen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {LEVELS.map((l) => (
                            <tr key={l} className="border-b last:border-0">
                              <td className="py-1 pr-3">{LEVEL_LABELS[l]}</td>
                              <td className="py-1">{u.levels![l]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {u.outliers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Żaden przełożony nie odstaje wyraźnie od średniej komórki.</p>
                      ) : (
                        u.outliers.map((o) => (
                          <Notice key={o.evaluatorId} tone="warning" title={`${o.evaluatorName}: średnia ${formatPoints(o.average)} pkt z ${o.count} ${plural(o.count, ["oceny", "ocen", "ocen"])}`}>
                            {o.signal.title.replace("Twoje oceny są", "Oceny są")}. Warto porozmawiać o wspólnych oczekiwaniach – to sygnał, nie zarzut.
                          </Notice>
                        ))
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        Progi sygnałów
        <InfoTip legalBasis="data/przepisy.json – mirror">
          Przełożony odstaje, gdy średnia jego ocen różni się o co najmniej {formatPoints(rules.mirror.leniencyDiffPoints)} pkt od średniej komórki. Progi HR
          może zmienić w parametrach przepisów.
        </InfoTip>
      </p>
    </>
  );
}
