// Wspólne kroki testów end-to-end (Z30).
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "../src/lib/auth/demo";
import { ROLE_HOME } from "../src/lib/auth/role";

export const EWA = DEMO_ACCOUNTS.find((a) => a.role === "PRZELOZONY")!;
export const HR = DEMO_ACCOUNTS.find((a) => a.role === "HR")!;

/** Logowanie formularzem (działa także bez DEMO_MODE, gdy karty kont demo są ukryte). */
export async function login(page: Page, account: DemoAccount): Promise<void> {
  await page.goto("/logowanie");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(ROLE_HOME[account.role]));
}

/** Naruszenia WCAG 2.1 A/AA według axe-core – lista czytelna w raporcie (reguła, opis, pierwsze elementy). */
export async function a11yViolations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.map(
    (v) => `${v.id} (${v.impact ?? "?"}): ${v.help} – ${v.nodes.length}× np. ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`,
  );
}

/** Kontrola jakości UX z docs/UX.md: jeden h1, jeden main, bez poziomego przewijania, 0 naruszeń axe. */
export async function expectGoodScreen(page: Page, name: string): Promise<void> {
  await expect(page.locator("main"), `${name}: jeden <main>`).toHaveCount(1);
  await expect(page.locator("h1"), `${name}: jeden <h1>`).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: poziome przewijanie (${overflow} px)`).toBeLessThanOrEqual(1);
  expect(await a11yViolations(page), `${name}: naruszenia WCAG 2.1 A/AA`).toEqual([]);
}

/** Błędy w konsoli przeglądarki (bez komunikatów narzędzi deweloperskich). */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/React DevTools|Download the React/i.test(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** Dzisiejsza data w strefie Europe/Warsaw (RRRR-MM-DD) – jak `todayIso` w aplikacji. */
export function todayWarsaw(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
}
