// Tryb rozmowy (Z43) w przeglądarce: punkty po kolei, odhaczanie zakresu z przepisu, notatka do dziennika, zapis przebiegu.
import { expect, test } from "@playwright/test";
import { EWA, expectGoodScreen, login } from "./pomocnicze";

test("rozmowa oceniająca z Katarzyną Wójcik od startu do zapisu przebiegu", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page, EWA);
  await page.goto("/ocena/rozmowa");
  await page.getByRole("link", { name: "Przygotuj rozmowę: Katarzyna Wójcik" }).click();
  await page.getByRole("link", { name: "Tryb rozmowy" }).click();
  await page.waitForURL(/\/tryb/);

  await page.getByRole("button", { name: "Rozpocznij rozmowę" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expectGoodScreen(page, "tryb rozmowy – punkt 1");

  const points = page.getByRole("navigation", { name: "Punkty rozmowy" }).getByRole("button");
  const total = await points.count();
  let required = 0;
  for (let i = 0; i < total; i++) {
    if (await page.getByText("punkt obowiązkowy").isVisible()) {
      required++;
      await page.getByRole("checkbox", { name: "Omówione", exact: true }).check();
      if (required === 1) {
        await page.getByLabel("Notatka do tego punktu").fill("Dwanaście opinii w terminie, dwie poprawione po uwagach dyrektora.");
        await page.getByRole("button", { name: "Zapisz w dzienniku obserwacji" }).click();
        await expect(page.getByRole("button", { name: "Zapisano w dzienniku" })).toBeVisible();
      }
    }
    if (i < total - 1) {
      // Klawiatura: → przechodzi dalej (fokus poza polem notatki).
      await page.getByRole("heading", { level: 2 }).focus();
      await page.keyboard.press("ArrowRight");
    }
  }
  expect(required).toBe(3); // § 10: trzy punkty zakresu rozmowy oceniającej

  await page.getByRole("button", { name: /Zakończ rozmowę/ }).click();
  await expect(page.getByRole("heading", { name: "Podsumowanie rozmowy" })).toBeVisible();
  await expect(page.getByText(/Nie omówiono/)).toHaveCount(0);
  await expect(page.getByLabel("Przebieg rozmowy")).toHaveValue(/Omówiono:[\s\S]*Notatki:[\s\S]*Dwanaście opinii/);
  await expectGoodScreen(page, "tryb rozmowy – podsumowanie");

  await page.getByRole("button", { name: "Zapisz przebieg rozmowy" }).click();
  await expect(page.getByText(/Zapisano przebieg rozmowy|Dopisano notatki/)).toBeVisible();

  // Notatka zapisana w trakcie rozmowy czeka w dzienniku obserwacji na przypięcie do wskaźnika.
  await page.goto("/obserwacje");
  await expect(page.getByText(/Dwanaście opinii w terminie/).first()).toBeVisible();
});
