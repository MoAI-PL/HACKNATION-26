// Pełna ocena okresowa w przeglądarce („serce rozwiązania”): ocena wskaźników kartami zachowań,
// decyzja zgodna z sugestią, podsumowanie z wynikiem, sporządzenie oceny i arkusz PDF.
// Test mierzy czas przejścia (bez myślenia człowieka) i liczbę wskaźników – wynik w raporcie i w docs/UX.md.
import { expect, test } from "@playwright/test";
import { EWA, login, todayWarsaw } from "./pomocnicze";

test("Katarzyna Wójcik: od oceny wskaźników do sporządzonej oceny i PDF", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await login(page, EWA);
  await page.goto("/ocena/okresowa");
  await page.getByRole("listitem").filter({ hasText: "Katarzyna Wójcik" }).getByRole("link", { name: /^Oceń$/ }).click();
  await page.waitForURL(/\/ocena\/okresowa\/[^/]+\/ocena$/);

  const started = Date.now();
  let criteria = 0;
  let indicators = 0;
  const toSummary = page.getByRole("link", { name: "Dalej: podsumowanie i wynik" });

  // Kryteria po kolei, aż do przeglądu ocen (7 kryteriów arkusza C + przegląd).
  for (let guard = 0; guard < 12 && !(await toSummary.isVisible()); guard++) {
    const nav = page.getByRole("navigation", { name: "Wskaźniki kryterium" });
    await expect(nav).toBeVisible();
    const buttons = nav.getByRole("button");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
      // Trzecia karta = zachowanie „na poziomie oczekiwań”.
      await page.getByRole("radiogroup", { name: /^Zachowanie:/ }).getByRole("radio").nth(2).click();
      indicators++;
    }
    await expect(page.getByText("Zapisywanie…")).toHaveCount(0);

    const decision = page.getByRole("radiogroup", { name: /^Ocena cząstkowa:/ });
    const label = (await decision.getAttribute("aria-label"))!;
    await decision.getByRole("radio", { name: /Sugestia/ }).click();
    await page.getByRole("button", { name: /^Zatwierdź i dalej/ }).click();
    await expect(page.getByRole("radiogroup", { name: label, exact: true })).toHaveCount(0);
    criteria++;
  }

  await expect(toSummary).toBeVisible();
  await toSummary.click();
  await page.waitForURL(/\/podsumowanie$/);

  await page.getByLabel("Wnioski do indywidualnego programu rozwoju zawodowego (IPRZ)").fill(
    "Udział w szkoleniu z wystąpień publicznych w I kwartale; prowadzenie jednego spotkania zespołu w miesiącu.",
  );
  const date = page.getByLabel("Data sporządzenia oceny na piśmie");
  if (!(await date.inputValue())) await date.fill(todayWarsaw());
  await page.getByRole("button", { name: "Sporządź ocenę" }).click();
  await expect(page.getByText(/Ocena sporządzona/)).toBeVisible();
  const seconds = Math.round((Date.now() - started) / 1000);

  // Arkusz PDF do pobrania.
  const pdfLink = page.getByRole("link", { name: /plik PDF/ }).first();
  const href = await pdfLink.getAttribute("href");
  expect(href).toBeTruthy();
  const pdf = await page.request.get(href!); // ten sam kontekst – ta sama sesja
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  const summary = `Pełna ocena (${criteria} kryteriów, ${indicators} wskaźników) przechodzi w ${seconds} s czasu technicznego.`;
  testInfo.annotations.push({ type: "pomiar", description: summary });
  console.log(summary);
  expect(criteria).toBe(7);
});
