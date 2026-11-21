// Role i dostęp do ekranów (Z04). Czysta logika bez zależności od Next.js i Auth.js,
// więc działa też w middleware (edge) i w testach.
import type { Role } from "@/lib/domain/types";
import { ROLES } from "@/lib/domain/types";

/** Ekran startowy każdej roli – tu trafia użytkownik po zalogowaniu. */
export const ROLE_HOME: Record<Role, string> = {
  PRZELOZONY: "/pulpit",
  HR: "/hr",
  OCENIANY: "/moje-oceny",
  KIERUJACY_KOMORKA: "/kierujacy",
};

/**
 * Obszary aplikacji i role, które mają do nich dostęp.
 * Nowy ekran roli = nowy wpis tutaj (prefiks ścieżki).
 */
export const PROTECTED_AREAS: ReadonlyArray<{ prefix: string; roles: readonly Role[] }> = [
  { prefix: "/pulpit", roles: ["PRZELOZONY"] },
  { prefix: "/ocena", roles: ["PRZELOZONY"] },
  { prefix: "/obserwacje", roles: ["PRZELOZONY"] },
  { prefix: "/asystent", roles: ["PRZELOZONY", "HR"] },
  { prefix: "/hr", roles: ["HR"] },
  { prefix: "/moje-oceny", roles: ["OCENIANY"] },
  { prefix: "/kierujacy", roles: ["KIERUJACY_KOMORKA"] },
];

/** Ścieżki dostępne bez logowania. */
export const PUBLIC_PATHS = ["/logowanie"] as const;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => matchesPrefix(pathname, p));
}

/** Role uprawnione do ścieżki albo `null`, gdy ścieżka nie należy do żadnego obszaru roli. */
export function rolesForPath(pathname: string): readonly Role[] | null {
  const area = PROTECTED_AREAS.find((a) => matchesPrefix(pathname, a.prefix));
  return area ? area.roles : null;
}

/** Czy zalogowany użytkownik z daną rolą może otworzyć ścieżkę. */
export function canAccessPath(role: Role, pathname: string): boolean {
  const roles = rolesForPath(pathname);
  return roles === null || roles.includes(role);
}

/**
 * Bezpieczny adres powrotu po zalogowaniu: tylko ścieżka wewnętrzna,
 * do której rola ma dostęp. W innym przypadku ekran startowy roli.
 */
export function safeRedirectFor(role: Role, callbackUrl: string | null | undefined): string {
  if (
    callbackUrl &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//") &&
    !callbackUrl.startsWith("/\\") &&
    !isPublicPath(callbackUrl) &&
    canAccessPath(role, callbackUrl.split("?")[0])
  ) {
    return callbackUrl;
  }
  return ROLE_HOME[role];
}
