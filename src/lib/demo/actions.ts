"use server";
// Akcja „Resetuj dane demo” – tylko rola HR i tylko przy DEMO_MODE=true.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { DemoResetDisabledError, resetDemoData } from "./reset";

export async function resetDemoAction(): Promise<void> {
  const user = await requireRole("HR");
  let message = "reset";
  try {
    await resetDemoData(prisma, user.id);
  } catch (e) {
    if (!(e instanceof DemoResetDisabledError)) throw e;
    message = "reset-wylaczony";
  }
  revalidatePath("/", "layout"); // wszystkie ekrany pokazują dane od nowa
  redirect(`/hr?komunikat=${message}`);
}
