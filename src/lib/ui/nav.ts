// Nawigacja główna według grafiki MC (materialy/Sciezki_oceny.png) – Z10.
// Adresy są propozycją dla zadań ekranów (Z11–Z24); grupy tras (przelozony)/(hr) nie zmieniają URL,
// więc każdy ekran ma prawdziwy segment adresu.

import type { Role } from "@/lib/domain/types";

export type NavIcon =
  | "pulpit"
  | "pierwsza"
  | "okresowa"
  | "dziennik"
  | "asystent-formalny"
  | "asystent-rozmowy"
  | "hr"
  | "moje";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Krótki opis pod etykietą (dostępny też dla czytników ekranu). */
  description?: string;
}

const PRZELOZONY: NavItem[] = [
  { href: "/pulpit", label: "Pulpit", icon: "pulpit", description: "Co mam dziś zrobić" },
  { href: "/pierwsza-ocena", label: "Pierwsza ocena", icon: "pierwsza" },
  { href: "/ocena-okresowa", label: "Ocena okresowa", icon: "okresowa" },
  { href: "/dziennik", label: "Dziennik obserwacji", icon: "dziennik" },
  { href: "/asystent-formalny", label: "Asystent formalny", icon: "asystent-formalny", description: "Procedura, formularze, terminy" },
  { href: "/asystent-rozmowy", label: "Asystent rozmowy", icon: "asystent-rozmowy", description: "Rozmowa, informacja zwrotna, rozwój" },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  PRZELOZONY,
  KIERUJACY_KOMORKA: PRZELOZONY,
  HR: [
    { href: "/hr", label: "Panel HR", icon: "hr", description: "Oceny, terminy, przypomnienia" },
    { href: "/asystent-formalny", label: "Asystent formalny", icon: "asystent-formalny" },
  ],
  OCENIANY: [{ href: "/moje-oceny", label: "Moje oceny", icon: "moje" }],
};

export function navForRole(role: Role): NavItem[] {
  return NAV_BY_ROLE[role];
}

/** Czy pozycja menu jest aktywna dla bieżącej ścieżki (także podstrony). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Czy rola ma skróty N (notatka) i / (asystent) – notatki robi tylko przełożony. */
export function roleHasQuickNote(role: Role): boolean {
  return role === "PRZELOZONY" || role === "KIERUJACY_KOMORKA";
}
