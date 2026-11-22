// Pierwsza ocena (Z17) w przeglądarce: ekrany obu etapów demo i pełna ścieżka Joanny Lewandowskiej –
// ocena pięciu elementów w skali 3/5/7, wynik według § 10, sporządzenie, arkusz PDF i zapoznanie.
import { expect, test } from "@playwright/test";
import { EWA, expectGoodScreen, login, todayWarsaw } from "./pomocnicze";

async function firstEvalHref(page: import("@playwright/test").Page, person: string): Promise<string> {
  await page.goto("/ocena/pierwsza");
  const href = await page.getByRole("listitem").filter({ hasText: person }).getByRole("link").first().getAttribute("href");
  expect(href, `link przy ${person}`).toBeTruthy();
  return href!;
}

test("lista i przebieg pierwszej oceny przy 768 i 1440 px", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page, EWA);
  const aleksandra = await firstEvalHref(page, "Aleksandra Mazur");
  const joanna = await firstEvalHref(page, "Joanna Lewandowska");
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/ocena/pierwsza", aleksandra, joanna, `${joanna}/ocena`]) {
      await page.goto(path);
      await expectGoodScreen(page, `${path} @ ${width}px`);
    }
  }
  // Etap Aleksandry: formularz rozmowy wstępnej z proponowanym terminem sprawozdania.
  await page.goto(aleksandra);
  await expect(page.getByText(/Rozmowa wstępna/).first()).toBeVisible();
});

test("Joanna Lewandowska: od oceny elementów do zapoznania się z oceną i PDF", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await login(page, EWA);
  const href = await firstEvalHref(page, "Joanna Lewandowska");
  await page.goto(href);
  await page.getByRole("link", { name: /Oceń elementy|Kontynuuj ocenę elementów/ }).click();
  await page.waitForURL(/\/ocena\/pierwsza\/[^/]+\/ocena$/);

  const started = Date.now();
  let elements = 0;
  const toSummary = page.getByRole("link", { name: "Dalej: podsumowanie i wynik" });
  for (let guard = 0; guard < 8 && !(await toSummary.isVisible()); guard++) {
    const nav = page.getByRole("navigation", { name: "Wskaźniki kryterium" });
    await expect(nav).toBeVisible();
    const buttons = nav.getByRole("button");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
      await page.getByRole("radiogroup", { name: /^Zachowanie:/ }).getByRole("radio").nth(2).click();
    }
    await expect(page.getByText("Zapisywanie…")).toHaveCount(0);
    const decision = page.getByRole("radiogroup", { name: /^Ocena cząstkowa:/ });
    // Skala pierwszej oceny: trzy poziomy 3 / 5 / 7 pkt.
    await expect(decision.getByRole("radio")).toHaveCount(3);
    const label = (await decision.getAttribute("aria-label"))!;
    await decision.getByRole("radio", { name: /Sugestia/ }).click();
    await page.getByRole("button", { name: /^Zatwierdź i dalej/ }).click();
    await expect(page.getByRole("radiogroup", { name: label, exact: true })).toHaveCount(0);
    elements++;
  }
  expect(elements).toBe(5);
  await toSummary.click();
  await page.waitForURL(/\/ocena\/pierwsza\/[^/]+$/);

  // Wynik według § 10: wszystkie elementy „na poziomie oczekiwań”, egzamin zdany, sprawozdanie w terminie → pozytywna.
  await expect(page.getByText(/pozytywn/i).first()).toBeVisible();
  const date = page.getByLabel("Data sporządzenia oceny");
  if (!(await date.inputValue())) await date.fill(todayWarsaw());
  await page.getByRole("button", { name: "Sporządź ocenę" }).click();
  await expect(page.getByLabel("Data zapoznania się z oceną")).toBeVisible();

  const pdfLink = page.getByRole("link", { name: /PDF/ }).first();
  const pdf = await page.request.get((await pdfLink.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  await page.getByLabel("Data zapoznania się z oceną").fill(todayWarsaw());
  await page.getByRole("button", { name: "Potwierdź zapoznanie się z oceną" }).click();
  await expect(page.getByText("Pierwsza ocena zakończona")).toBeVisible();
  await expectGoodScreen(page, "pierwsza ocena – zakończona");

  const summary = `Pierwsza ocena (5 elementów) od kart zachowań do zapoznania – ${Math.round((Date.now() - started) / 1000)} s czasu technicznego.`;
  testInfo.annotations.push({ type: "pomiar", description: summary });
  console.log(summary);
});
