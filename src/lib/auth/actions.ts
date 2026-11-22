"use server";
// Akcje serwerowe logowania i wylogowania.
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { DEMO_PASSWORD, findDemoAccount, isDemoMode } from "./demo";
import { safeRedirectFor, isRole } from "./role";

export type LoginState = { error?: string } | undefined;

const BAD_CREDENTIALS = "Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.";
const SERVER_ERROR = "Nie udało się zalogować z powodu błędu serwera. Spróbuj ponownie za chwilę.";

async function redirectTargetFor(email: string, callbackUrl: string | null): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  return user && isRole(user.role) ? safeRedirectFor(user.role, callbackUrl) : "/";
}

async function doSignIn(email: string, password: string, callbackUrl: string | null): Promise<LoginState> {
  try {
    const redirectTo = await redirectTargetFor(email, callbackUrl);
    // Przy sukcesie signIn rzuca przekierowanie Next.js – nie łapiemy go.
    await signIn("credentials", { email, password, redirectTo });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.type === "CredentialsSignin" ? BAD_CREDENTIALS : SERVER_ERROR };
    }
    throw error;
  }
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = formData.get("callbackUrl");
  if (!email || !password) return { error: "Podaj e-mail i hasło." };
  return doSignIn(email, password, typeof callbackUrl === "string" ? callbackUrl : null);
}

/** Logowanie jednym kliknięciem z karty konta demo. Działa wyłącznie przy DEMO_MODE=true. */
export async function demoLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isDemoMode()) return { error: "Konta demo są wyłączone." };
  const account = findDemoAccount(String(formData.get("email") ?? ""));
  if (!account) return { error: "Nie ma takiego konta demo." };
  const result = await doSignIn(account.email, DEMO_PASSWORD, null);
  if (result?.error === BAD_CREDENTIALS) {
    return { error: "Konto demo nie istnieje w bazie. Uruchom „npm run seed” i spróbuj ponownie." };
  }
  return result;
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/logowanie" });
}
