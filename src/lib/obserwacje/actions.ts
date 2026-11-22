"use server";
// Akcje serwerowe dziennika obserwacji. Autoryzacja w każdej akcji, nie tylko w layoucie.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { validateObservation, type FieldErrors } from "./dziennik";
import { createObservation, deleteObservation, isSubordinate, updateObservation } from "./repo";

/** Stan formularza po nieudanym zapisie: błędy przy polach i wpisane wartości (żeby nic nie przepadło). */
export type ObservationFormState = { errors?: FieldErrors; message?: string; values?: Record<string, string>; attempt?: number } | undefined;

const FIELDS = ["employeeId", "date", "indicatorId", "behaviorLevel", "situation", "action", "outcome"] as const;

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
}

/** Zapis nowej albo zmienionej obserwacji (pole `id` = edycja). Po sukcesie powrót do dziennika tej osoby. */
export async function saveObservationAction(_prev: ObservationFormState, formData: FormData): Promise<ObservationFormState> {
  const user = await requireRole("PRZELOZONY");
  const id = String(formData.get("id") ?? "").trim() || null;

  const values = formValues(formData);
  const failed = (s: Omit<NonNullable<ObservationFormState>, "values" | "attempt">): ObservationFormState => ({ ...s, values, attempt: Date.now() });

  const result = validateObservation(values, todayIso());
  if (!result.ok) return failed({ errors: result.errors, message: "Popraw zaznaczone pola – obserwacja nie została zapisana." });

  if (!(await isSubordinate(user.id, result.data.employeeId))) {
    return failed({ errors: { employeeId: "Możesz dodawać obserwacje tylko swoich pracowników. Wybierz osobę z listy." } });
  }

  if (id) {
    if (!(await updateObservation(user.id, id, result.data))) {
      return failed({ message: "Tej obserwacji już nie ma albo nie dotyczy Twoich pracowników. Wróć do dziennika." });
    }
  } else {
    await createObservation(user.id, result.data);
  }

  revalidatePath("/obserwacje");
  redirect(`/obserwacje?osoba=${encodeURIComponent(result.data.employeeId)}&zapisano=${id ? "zmiana" : "nowa"}`);
}

export async function deleteObservationAction(formData: FormData): Promise<void> {
  const user = await requireRole("PRZELOZONY");
  const id = String(formData.get("id") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const deleted = id ? await deleteObservation(user.id, id) : false;
  revalidatePath("/obserwacje");
  redirect(`/obserwacje${employeeId ? `?osoba=${encodeURIComponent(employeeId)}&` : "?"}zapisano=${deleted ? "usunieto" : "brak"}`);
}
