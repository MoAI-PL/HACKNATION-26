// Sprawdzenie e-maila i hasła. Dostęp do bazy przekazywany z zewnątrz, żeby dało się to testować bez PostgreSQL.
import { z } from "zod";
import type { Role } from "@/lib/domain/types";
import { isRole } from "./role";
import { verifyPassword } from "./password";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
});

export type AuthUser = { id: string; email: string; name: string; role: Role };

export type UserRecord = AuthUser & { passwordHash: string };

export type FindUserByEmail = (email: string) => Promise<UserRecord | null>;

/**
 * Zwraca użytkownika przy poprawnych danych, w każdym innym przypadku `null`.
 * Komunikat dla użytkownika jest zawsze ten sam, żeby nie zdradzać, które konta istnieją.
 */
export async function authorizeCredentials(
  input: unknown,
  findUserByEmail: FindUserByEmail,
): Promise<AuthUser | null> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;

  const user = await findUserByEmail(parsed.data.email);
  if (!user || !isRole(user.role)) return null;

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
