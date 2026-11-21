import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Info,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeadlineUrgency, EvaluationStatus, EvaluationType } from "@/lib/domain/types";
import { EVALUATION_STATUS_LABELS } from "@/lib/domain/slownik";
import { URGENCY_TONE, deadlineText, type Tone } from "@/lib/ui/status";

// Odznaki statusów (Z10, sekcja 4.1 pkt 8): kolor ZAWSZE razem z ikoną i tekstem.

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info border-info/30",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
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
  sm: { box: "gap-1 px-2.5 py-0.5 text-xs font-medium", icon: "size-3.5" },
  // Większa odznaka do miejsc, gdzie pilność jest najważniejszą informacją (karta „Do zrobienia”).
  md: { box: "gap-1.5 px-3 py-1 text-sm font-semibold", icon: "size-4" },
};

/**
 * Wariant „solid”: pełne tło i biały tekst – do miejsc, gdzie pilność ma być widoczna od razu (karta „Do zrobienia”).
 * Kontrast białego tekstu: danger 7,5:1, warning-strong 5,2:1, success 7,1:1, info 8,3:1, ai 7,1:1.
 */
const SOLID_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted-foreground text-white border-transparent",
  info: "bg-info text-white border-transparent",
  success: "bg-success text-white border-transparent",
  warning: "bg-warning-strong text-white border-transparent",
  danger: "bg-danger text-white border-transparent",
  ai: "bg-ai text-ai-foreground border-transparent",
};

export type BadgeVariant = "soft" | "solid";

export interface StatusBadgeProps extends React.ComponentProps<"span"> {
  tone?: Tone;
  icon?: LucideIcon | null;
  size?: BadgeSize;
  /** soft (domyślnie) – jasne tło i kolorowy tekst; solid – pełne kolorowe tło i biały tekst. */
  variant?: BadgeVariant;
}

export function StatusBadge({ tone = "neutral", icon, size = "sm", variant = "soft", className, children, ...props }: StatusBadgeProps) {
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

/** Odznaka terminu: „Po terminie (3 dni)”, „Zostało 5 dni”… z kolorem wg pilności. */
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

const STATUS_TONE: Record<EvaluationStatus, Tone> = {
  DO_ROZPOCZECIA: "warning",
  W_OKRESIE_OCENY: "info",
  W_OCENIE: "warning",
  CZEKA_NA_ZAPOZNANIE: "info",
  ZAKONCZONA: "success",
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
    <StatusBadge tone={STATUS_TONE[status]} className={className}>
      {EVALUATION_STATUS_LABELS[type][status]}
    </StatusBadge>
  );
}
