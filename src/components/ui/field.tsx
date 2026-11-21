import * as React from "react";
import { cn } from "@/lib/utils";

// Pola formularza z etykietą, podpowiedzią i błędem powiązanymi przez aria-describedby (WCAG: etykiety wszystkich pól).

const inputBase =
  "w-full rounded-md border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

export interface FieldProps {
  label: React.ReactNode;
  /** Podpowiedź pod etykietą, np. format daty. */
  hint?: React.ReactNode;
  /** Błąd: co się stało i co zrobić. */
  error?: string;
  required?: boolean;
  /** Dodatkowy element obok etykiety, np. <InfoTip>. */
  aside?: React.ReactNode;
  className?: string;
  /** Pole formularza; otrzyma id, aria-describedby i aria-invalid. */
  children: React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    required?: boolean;
  }>;
}

export function Field({ label, hint, error, required, aside, className, children }: FieldProps) {
  const autoId = React.useId();
  const id = children.props.id ?? autoId;
  const hintId = hint ? `${id}-podpowiedz` : undefined;
  const errorId = error ? `${id}-blad` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="text-danger" aria-hidden>
              {" "}
              *
            </span>
          )}
        </Label>
        {aside}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
