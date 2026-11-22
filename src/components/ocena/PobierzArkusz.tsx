import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EvaluationStatus, EvaluationType } from "@/lib/domain/types";
import { sheetDownloads } from "@/lib/pdf/arkusz";

/**
 * Pobranie arkusza B / C w PDF: część I po ustaleniu kryteriów (kopia dla ocenianego, § 6 ust. 3),
 * pełny arkusz po sporządzeniu oceny (§ 12 ust. 2). Gdy wydruk nie jest jeszcze możliwy – nic nie pokazujemy (bez martwych linków).
 */
export function PobierzArkusz({
  evaluationId,
  type,
  status,
  hasCriteria,
}: {
  evaluationId: string;
  type: EvaluationType;
  status: EvaluationStatus;
  hasCriteria: boolean;
}) {
  const links = sheetDownloads({ evaluationId, type, status, hasCriteria });
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Button key={l.href} asChild variant="outline">
          <a href={l.href} target="_blank" rel="noreferrer" className="no-underline">
            <FileDown aria-hidden />
            {l.label}
            <span className="sr-only"> (plik PDF otworzy się w nowej karcie)</span>
          </a>
        </Button>
      ))}
    </div>
  );
}
