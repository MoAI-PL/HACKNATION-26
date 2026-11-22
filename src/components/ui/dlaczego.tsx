// „ⓘ Dlaczego?” z treścią z data/podpowiedzi.json: wyjaśnienie, podstawa prawna, cytat z przepisu i link do ISAP.
//   <Dlaczego id="KRYTERIA_DODATKOWE" />

import { InfoTip } from "@/components/ui/info-tip";
import { hint, type HintId } from "@/lib/ui/dlaczego";

export function Dlaczego({ id, label, className }: { id: HintId; label?: string; className?: string }) {
  const h = hint(id);
  return (
    <InfoTip legalBasis={h.legalBasis} quote={`„${h.quote}”`} href={h.href} label={label} topic={h.topic} className={className}>
      {h.text}
    </InfoTip>
  );
}
