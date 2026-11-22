import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock,
  Hourglass,
  Info,
  NotebookPen,
  PenLine,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeadlineUrgency, EvaluationStatus, EvaluationType } from "@/lib/domain/types";
import { EVALUATION_STATUS_LABELS } from "@/lib/domain/slownik";
import { URGENCY_TONE, deadlineText, type Tone } from "@/lib/ui/status";

// Odznaki statusów (Z10, sekcja 4.1 pkt 8): kolor ZAWSZE razem z ikoną i tekstem.
// Jeden język kolorów w całej aplikacji – każda odznaka wyraźna, z pełnym tłem i białym tekstem:
//  - termin (pilność): czerwony (pilne / po terminie), pomarańczowy (wkrótce), zielony (w terminie);
//  - etap oceny: granat z ikoną etapu; zakończona ocena – zielona;
//  - pozostałe (np. rodzaj kryterium): szary; propozycja AI: fiolet;
//  - ten sam odcień danego koloru w odznakach, komunikatach i tekście (tokeny w globals.css).

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info border-info/40",
  success: "bg-success-soft text-success border-success/40",
  warning: "bg-warning-soft text-warning border-warning-strong/50",
  danger: "bg-danger-soft text-danger border-danger/40",
  ai: "bg-ai-soft text-ai border-ai-border/50",
};

const TONE_ICONS: Record<Tone, LucideIcon> = {
  neutral: Circle,
  info: Info,
  success: CheckCircle2,
  warning: Clock,
  danger: AlertTriangle,
  ai: Sparkles,
};

export type BadgeSize = "sm" | "md";

const SIZE_CLASSES: Record<BadgeSize, { box: string; icon: string }> = {
  sm: { box: "gap-1 px-2.5 py-0.5 text-xs font-semibold", icon: "size-3.5" },
  // Większa odznaka do miejsc, gdzie pilność jest najważniejszą informacją (karta „Do zrobienia”).
  md: { box: "gap-1.5 px-3 py-1 text-sm font-semibold", icon: "size-4" },
};

/**
 * Wariant „solid”: pełne tło i biały tekst – do miejsc, gdzie pilność ma być widoczna od razu (karta „Do zrobienia”).
 * Kontrast białego tekstu: danger 7,5:1, warning-strong 5,2:1, success 7,1:1, info 8,3:1, ai 7,1:1.
 */
const SOLID_CLASSES: Record<Tone, string> = {
  neutral: "bg-neutral-strong text-white border-transparent",
  info: "bg-info-strong text-white border-transparent",
  success: "bg-success-strong text-white border-transparent",
  warning: "bg-warning-strong text-white border-transparent",
  danger: "bg-danger-strong text-white border-transparent",
  ai: "bg-ai text-ai-foreground border-transparent",
};

export type BadgeVariant = "soft" | "solid";

export interface StatusBadgeProps extends React.ComponentProps<"span"> {
  tone?: Tone;
  icon?: LucideIcon | null;
  size?: BadgeSize;
  /** solid (domyślnie, cała aplikacja) – pełne kolorowe tło i biały tekst; soft – jasne tło (tylko wyjątkowo). */
  variant?: BadgeVariant;
}

export function StatusBadge({ tone = "neutral", icon, size = "sm", variant = "solid", className, children, ...props }: StatusBadgeProps) {
  const Icon = icon === null ? null : (icon ?? TONE_ICONS[tone]);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border whitespace-nowrap",
        SIZE_CLASSES[size].box,
        variant === "solid" ? SOLID_CLASSES[tone] : TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={cn("shrink-0", SIZE_CLASSES[size].icon)} aria-hidden />}
      {children}
    </span>
  );
}

/** Odznaka terminu: „Po terminie (3 dni)”, „Zostało 5 dni”… z kolorem wg pilności – domyślnie z pełnym tłem, wszędzie tak samo. */
export function DeadlineBadge({
  daysLeft,
  urgency,
  label,
  size,
  variant,
  className,
}: {
  daysLeft: number;
  urgency: DeadlineUrgency;
  /** Własny tekst zamiast domyślnego, np. „do pt. 28.11”. */
  label?: string;
  size?: BadgeSize;
  variant?: BadgeVariant;
  className?: string;
}) {
  const tone = URGENCY_TONE[urgency];
  return (
    <StatusBadge tone={tone} size={size} variant={variant} icon={urgency === "PO_TERMINIE" ? XCircle : undefined} className={className}>
      {label ?? deadlineText(daysLeft)}
    </StatusBadge>
  );
}

// Etap to nie termin – kolory pilności zostają dla terminów; etapy różnią się ikoną.
const STATUS_TONE: Record<EvaluationStatus, Tone> = {
  DO_ROZPOCZECIA: "info",
  W_OKRESIE_OCENY: "info",
  W_OCENIE: "info",
  CZEKA_NA_ZAPOZNANIE: "info",
  ZAKONCZONA: "success",
};

const STATUS_ICON: Record<EvaluationStatus, LucideIcon> = {
  DO_ROZPOCZECIA: CircleDashed,
  W_OKRESIE_OCENY: NotebookPen,
  W_OCENIE: PenLine,
  CZEKA_NA_ZAPOZNANIE: Hourglass,
  ZAKONCZONA: CheckCircle2,
};

/** Odznaka etapu procesu oceny, np. „Kryteria ustalone”, „Czeka na zapoznanie”. */
export function EvaluationStatusBadge({
  type,
  status,
  className,
}: {
  type: EvaluationType;
  status: EvaluationStatus;
  className?: string;
}) {
  return (
    <StatusBadge tone={STATUS_TONE[status]} icon={STATUS_ICON[status]} className={className}>
      {EVALUATION_STATUS_LABELS[type][status]}
    </StatusBadge>
  );
}
