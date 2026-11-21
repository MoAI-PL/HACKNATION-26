"use server";
// Akcje serwerowe panelu HR (Z18). Każda sprawdza rolę HR (Z04).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { needsReminder, reminderFor, toHrRow } from "./panel";
import { createReminder, listHrRecords, listReminders, markReminderSent } from "./repo";

const back = (msg: string) => redirect(`/hr?komunikat=${msg}#przypomnienia`);

/** „Wyślij” – symulacja wysyłki e-maila z przypomnieniem. */
export async function sendReminderAction(formData: FormData): Promise<void> {
  const user = await requireRole("HR");
  const id = String(formData.get("id") ?? "").trim();
  const ok = id ? await markReminderSent(user.id, id) : false;
  revalidatePath("/hr");
  back(ok ? "wyslano" : "juz-wyslane");
}

/** „Dodaj przypomnienie” dla oceny z bliskim terminem – treść z silnika terminów, odbiorca: oceniający. */
export async function addReminderAction(formData: FormData): Promise<void> {
  await requireRole("HR");
  const evaluationId = String(formData.get("evaluationId") ?? "").trim();
  const record = (await listHrRecords()).find((r) => r.id === evaluationId);
  if (!record) back("brak-oceny");
  const row = toHrRow(record!, todayIso());
  const draft = reminderFor(row);
  if (!draft || !needsReminder(row, await listReminders())) back("nie-trzeba");
  await createReminder({ recipientId: row.evaluatorId, employeeId: row.employeeId, evaluationId, draft: draft! });
  revalidatePath("/hr");
  back("dodano");
}
