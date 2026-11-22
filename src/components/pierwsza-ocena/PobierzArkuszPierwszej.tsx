import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { firstSheetHref } from "@/lib/pdf/arkusz-pierwszej";

/** Pobranie arkusza pierwszej oceny w PDF (Z17) – po rozmowie wstępnej, z wynikiem po sporządzeniu oceny. */
export function PobierzArkuszPierwszej({ evaluationId, label = "Pobierz arkusz pierwszej oceny (PDF)" }: { evaluationId: string; label?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href={firstSheetHref(evaluationId)} target="_blank" rel="noreferrer" className="no-underline">
          <FileDown aria-hidden />
          {label}
          <span className="sr-only"> (plik PDF otworzy się w nowej karcie)</span>
        </a>
      </Button>
    </div>
  );
}
