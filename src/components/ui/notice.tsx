import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Komunikat (Z10, sekcja 4.1 pkt 4): co się stało, dlaczego (podstawa prawna) i co zrobić.
// Błędy i ostrzeżenia ogłaszane czytnikom ekranu (role="alert"), informacje – grzecznie (role="status").

type NoticeTone = "info" | "success" | "warning" | "error";

const STYLES: Record<NoticeTone, { box: string; icon: LucideIcon }> = {
  info: { box: "bg-info-soft border-info/30 text-info", icon: Info },
  success: { box: "bg-success-soft border-success/30 text-success", icon: CheckCircle2 },
  warning: { box: "bg-warning-soft border-warning/30 text-warning", icon: AlertTriangle },
  error: { box: "bg-danger-soft border-danger/30 text-danger", icon: XCircle },
};

export interface NoticeProps extends Omit<React.ComponentProps<"div">, "title"> {
  tone?: NoticeTone;
  title: React.ReactNode;
  /** Podstawa prawna, np. „§ 11 ust. 3” – wyświetlana dyskretnie pod treścią. */
  legalBasis?: string;
  /** Przycisk lub link „co zrobić”. */
  action?: React.ReactNode;
}

export function Notice({ tone = "info", title, legalBasis, action, className, children, ...props }: NoticeProps) {
  const { box, icon: Icon } = STYLES[tone];
  const urgent = tone === "error" || tone === "warning";
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border p-4", box, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">{title}</p>
        {children && <div className="text-sm text-foreground">{children}</div>}
        {legalBasis && <p className="text-xs text-muted-foreground">Podstawa: {legalBasis}</p>}
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}
