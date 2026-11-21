// Nawigacja główna według grafiki MC (materialy/Sciezki_oceny.png) – Z10.
// Adresy leżą w obszarach ról z src/lib/auth/role.ts (PROTECTED_AREAS, Z04):
// /pulpit, /ocena/…, /obserwacje i /asystent/… – przełożony; /kierujacy – kierujący komórką; /hr – HR; /moje-oceny – oceniany.
// Nowy ekran w menu = nowy wpis tutaj (i ewentualnie nowy obszar w role.ts).

import type { Role } from "@/lib/domain/types";

export type NavIcon =
  | "pulpit"
  | "pierwsza"
  | "okresowa"
  | "dziennik"
  | "asystent-formalny"
  | "asystent-rozmowy"
  | "hr"
  | "moje"
  | "podpis";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Krótki opis (podpowiedź po najechaniu). */
  description?: string;
  /**
   * Zadanie, które buduje ekran. Pozycja z `pending` jest ukryta w menu, dopóki ekranu nie ma
   * (zasada „bez martwych linków”). Zadanie ekranu usuwa `pending` w tym samym commicie, w którym dodaje stronę.
   */
  pending?: string;
}

/** Funkcje włączane przez zadania, które je budują – do tego czasu ich przyciski są ukryte (zasada „bez atrap”). */
export const FEATURES = {
  /** Z41: szybka notatka (przycisk „Notatka” i skrót N). */
  quickNote: false,
} as const;

/** Adres asystenta formalnego (Z22). */
export const ASSISTANT_HREF = "/asystent";

const ASYSTENT_FORMALNY: NavItem = {
  href: ASSISTANT_HREF,
  label: "Asystent formalny",
  icon: "asystent-formalny",
  description: "Procedura, formularze, terminy",
};

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  PRZELOZONY: [
    { href: "/pulpit", label: "Pulpit", icon: "pulpit", description: "Co mam dziś zrobić" },
    { href: "/ocena/pierwsza", label: "Pierwsza ocena", icon: "pierwsza", pending: "Z17" },
    { href: "/ocena/okresowa", label: "Ocena okresowa", icon: "okresowa" },
    { href: "/obserwacje", label: "Dziennik obserwacji", icon: "dziennik", description: "Notatki o zachowaniach na bieżąco" },
    ASYSTENT_FORMALNY,
    {
      href: "/ocena/rozmowa",
      label: "Asystent rozmowy",
      icon: "asystent-rozmowy",
      description: "Rozmowa, informacja zwrotna, rozwój",
      pending: "Z24",
    },
  ],
  // ZAŁOŻENIE: strona asystenta (Z22) leży w grupie (przelozony), więc na razie tylko przełożony.
  // role.ts dopuszcza /asystent także dla HR i kierującego – gdy strona trafi do wspólnego layoutu, dodać ASYSTENT_FORMALNY tutaj.
  KIERUJACY_KOMORKA: [{ href: "/kierujacy", label: "Arkusze do podpisu", icon: "podpis" }],
  HR: [{ href: "/hr", label: "Panel HR", icon: "hr", description: "Oceny, terminy, przypomnienia" }],
  OCENIANY: [{ href: "/moje-oceny", label: "Moje oceny", icon: "moje" }],
};

/** Menu widoczne dla roli – tylko gotowe ekrany. */
export function navForRole(role: Role): NavItem[] {
  return NAV_BY_ROLE[role].filter((item) => !item.pending);
}

/** Pełne docelowe menu roli (także ekrany w budowie) – do testów i dokumentacji. */
export function plannedNavForRole(role: Role): NavItem[] {
  return NAV_BY_ROLE[role];
}

/** Czy pozycja menu jest aktywna dla bieżącej ścieżki (także podstrony). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Szybkie notatki robi tylko przełożony – i tylko gdy funkcja jest gotowa (Z41). */
export function roleHasQuickNote(role: Role, enabled: boolean = FEATURES.quickNote): boolean {
  return enabled && role === "PRZELOZONY";
}

/** Czy rola ma w nagłówku i pod „/” asystenta formalnego – musi się zgadzać z menu (NAV_BY_ROLE). */
export function roleHasAssistant(role: Role): boolean {
  return navForRole(role).some((item) => item.href === ASSISTANT_HREF);
}
