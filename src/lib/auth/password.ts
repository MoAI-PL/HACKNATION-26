// Hasła: bcrypt. Wersja w czystym JS – bez kompilacji modułów natywnych na Windows i Vercelu.
import bcrypt from "bcryptjs";

/** Koszt bcrypt. 10 to rozsądny kompromis dla prototypu (ok. 50–100 ms na hash). */
export const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string, rounds: number = BCRYPT_ROUNDS): Promise<string> {
  return bcrypt.hash(plain, rounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
