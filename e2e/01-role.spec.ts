// Logowanie każdą rolą demo: właściwy ekran startowy, jakość ekranu (h1, main, przewijanie, axe) i wylogowanie.
import { expect, test } from "@playwright/test";
import { DEMO_ACCOUNTS } from "../src/lib/auth/demo";
import { ROLE_HOME } from "../src/lib/auth/role";
import { a11yViolations, collectConsoleErrors, expectGoodScreen, login } from "./pomocnicze";

test("ekran logowania: formularz z etykietami, bez naruszeń WCAG", async ({ page }) => {
  await page.goto("/logowanie");
  await expect(page.getByLabel("Hasło")).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  expect(await a11yViolations(page)).toEqual([]);
});

test("złe hasło – czytelny komunikat, bez logowania", async ({ page }) => {
  await page.goto("/logowanie");
  await page.locator("#email").fill(DEMO_ACCOUNTS[0]!.email);
  await page.locator("#password").fill("zle-haslo");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  await expect(page).toHaveURL(/\/logowanie/);
});

for (const account of DEMO_ACCOUNTS) {
  test(`${account.name} (${account.role}): ekran startowy i wylogowanie`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, account);
    await expect(page).toHaveURL(new RegExp(`${ROLE_HOME[account.role]}`));
    await expectGoodScreen(page, `${account.role} ${ROLE_HOME[account.role]}`);
    expect(errors, "błędy w konsoli").toEqual([]);

    await page.getByRole("button", { name: "Wyloguj" }).click();
    await page.waitForURL(/\/logowanie/);
    // Po wylogowaniu ekran roli nie jest dostępny.
    await page.goto(ROLE_HOME[account.role]);
    await expect(page).toHaveURL(/\/logowanie/);
  });
}

test("przełożona nie wejdzie do panelu HR", async ({ page }) => {
  await login(page, DEMO_ACCOUNTS.find((a) => a.role === "PRZELOZONY")!);
  await page.goto("/hr");
  await expect(page).not.toHaveURL(/\/hr$/);
});
