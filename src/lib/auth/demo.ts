// Konta demo (Z04). Widoczne na ekranie logowania i w README tylko przy DEMO_MODE=true.
// Dane są fikcyjne. Z26 dopina do nich kartoteki pracowników i podwładnych.
import type { Role } from "@/lib/domain/types";

/** Wspólne hasło kont demo – jawne celowo, żeby jury mogło się zalogować bez naszej pomocy. */
export const DEMO_PASSWORD = "Kompas2026!";

export type DemoAccount = {
  email: string;
  name: string;
  role: Role;
  /** Krótki opis na karcie „Zaloguj jako…”. */
  description: string;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: "ewa.kowalczyk@demo.kompas.test",
    name: "Ewa Kowalczyk",
    role: "PRZELOZONY",
    description: "Dyrektorka departamentu. Ocenia swoich podwładnych – główna ścieżka demo.",
  },
  {
    email: "hr@demo.kompas.test",
    name: "Anna Zielińska",
    role: "HR",
    description: "Komórka kadr. Terminy, przypomnienia, model kompetencji i parametry przepisów.",
  },
  {
    email: "jan.nowak@demo.kompas.test",
    name: "Jan Nowak",
    role: "OCENIANY",
    description: "Pracownik. Podgląd własnych ocen i potwierdzenie zapoznania się.",
  },
  {
    email: "kierujacy@demo.kompas.test",
    name: "Tomasz Wiśniewski",
    role: "KIERUJACY_KOMORKA",
    description: "Kierujący komórką. Pierwsze oceny nowych pracowników komórki i terminy, w których uczestniczy.",
  },
];

/** Tryb demo: karty kont na logowaniu i reset danych. Na produkcji DEMO_MODE=false. */
export function isDemoMode(value: string | undefined = process.env.DEMO_MODE): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function findDemoAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === normalized);
}
