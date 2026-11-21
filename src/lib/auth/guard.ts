// Strażnicy autoryzacji (Z04). Używaj ich w KAŻDYM handlerze API, akcji serwerowej i układzie ekranów roli.
// Ukrycie przycisku w interfejsie nie jest zabezpieczeniem.
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/lib/domain/types";
import { decideAccess, type SessionUser } from "./access";
import { ROLE_HOME } from "./role";

/** Błąd autoryzacji rzucany w akcjach serwerowych. */
export class AccessError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

/**
 * Ekrany (server components, layouty): brak sesji → logowanie, zła rola → ekran startowy własnej roli.
 */
export async function requirePageRole(...roles: Role[]): Promise<SessionUser> {
  const session = await auth();
  const decision = decideAccess(session, roles);
  if (decision.ok) return decision.user;
  const role = session?.user?.role;
  redirect(decision.status === 403 && role ? ROLE_HOME[role] : "/logowanie");
}

/** Akcje serwerowe: rzuca AccessError (401/403) zamiast przekierowania. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const decision = decideAccess(await auth(), roles);
  if (!decision.ok) throw new AccessError(decision.status, decision.message);
  return decision.user;
}

type RouteContext = { params: Promise<Record<string, string | string[]>> };
type AuthedHandler = (req: Request, ctx: RouteContext, user: SessionUser) => Promise<Response> | Response;

/**
 * Handlery API: `export const GET = withRole(["HR"], async (req, ctx, user) => …)`.
 * Bez sesji zwraca 401, przy złej roli 403 – zawsze JSON z komunikatem po polsku.
 * Pusta lista ról = wystarczy być zalogowanym.
 */
export function withRole(roles: readonly Role[], handler: AuthedHandler) {
  return async (req: Request, ctx: RouteContext): Promise<Response> => {
    const decision = decideAccess(await auth(), roles);
    if (!decision.ok) {
      return NextResponse.json({ error: decision.message }, { status: decision.status });
    }
    return handler(req, ctx, decision.user);
  };
}
