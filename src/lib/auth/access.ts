// Autoryzacja po stronie serwera (Z04): wspólna decyzja dla API, akcji serwerowych i ekranów.
// Czysta logika – sesję podaje wywołujący, więc testy nie potrzebują Auth.js.
import type { Role } from "@/lib/domain/types";
import { isRole } from "./role";

export type SessionUser = { id: string; name?: string | null; email?: string | null; role: Role };

export type AccessDecision =
  | { ok: true; user: SessionUser }
  | { ok: false; status: 401 | 403; message: string };

type SessionLike = { user?: { id?: string | null; role?: unknown; name?: string | null; email?: string | null } | null } | null | undefined;

export const MESSAGES = {
  401: "Musisz się zalogować, żeby wykonać tę operację.",
  403: "Twoja rola nie ma dostępu do tej operacji.",
} as const;

/**
 * Decyzja o dostępie.
 * - brak sesji albo niepełna sesja → 401;
 * - rola spoza listy → 403;
 * - pusta lista ról = wystarczy być zalogowanym.
 */
export function decideAccess(session: SessionLike, roles: readonly Role[] = []): AccessDecision {
  const u = session?.user;
  if (!u?.id || !isRole(u.role)) {
    return { ok: false, status: 401, message: MESSAGES[401] };
  }
  if (roles.length > 0 && !roles.includes(u.role)) {
    return { ok: false, status: 403, message: MESSAGES[403] };
  }
  return { ok: true, user: { id: u.id, name: u.name, email: u.email, role: u.role } };
}
