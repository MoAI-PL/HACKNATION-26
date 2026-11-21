// Ekrany ścieżki demo przy 768 i 1440 px: jeden h1 i main, bez poziomego przewijania, 0 naruszeń WCAG 2.1 A/AA, bez błędów konsoli.
import { expect, test, type Page } from "@playwright/test";
import { collectConsoleErrors, EWA, expectGoodScreen, HR, login } from "./pomocnicze";

const WIDTHS = [768, 1440] as const;

/** Adres pierwszego linku na stronie listy (np. „Oceń” przy Katarzynie Wójcik) – identyfikatory zmieniają się po seedzie. */
async function hrefOf(page: Page, listPath: string, person: string, linkName: RegExp): Promise<string> {
  await page.goto(listPath);
  const href = await page.getByRole("listitem").filter({ hasText: person }).getByRole("link", { name: linkName }).first().getAttribute("href");
  expect(href, `link „${linkName}” przy ${person} na ${listPath}`).toBeTruthy();
  return href!;
}

test.describe("przełożona", () => {
  test("pulpit, dziennik, ocena okresowa, asystenci, tryb rozmowy", async ({ page }) => {
    test.setTimeout(600_000);
    const errors = collectConsoleErrors(page);
    await login(page, EWA);

    const ocena = await hrefOf(page, "/ocena/okresowa", "Katarzyna Wójcik", /^Oceń$/);
    const czescI = await hrefOf(page, "/ocena/okresowa", "Marta Kamińska", /^Ustal kryteria$/);
    const sciaga = await hrefOf(page, "/ocena/rozmowa", "Katarzyna Wójcik", /Przygotuj rozmowę/);
    const employeeId = sciaga.split("/")[3]!.split("?")[0]!;

    const screens = [
      "/pulpit",
      `/pulpit/pracownik/${employeeId}`,
      "/obserwacje",
      "/obserwacje/nowa",
      "/ocena/okresowa",
      czescI,
      ocena,
      ocena.replace(/\/ocena$/, "/podsumowanie"),
      "/ocena/rozmowa",
      sciaga,
      sciaga.replace("?", "/tryb?"),
      "/asystent",
    ];

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of screens) {
        await page.goto(path);
        await expectGoodScreen(page, `${path} @ ${width}px`);
      }
    }
    expect(errors, "błędy w konsoli").toEqual([]);
  });
});

test.describe("HR", () => {
  test("panel HR, dziennik decyzji, lustro", async ({ page }) => {
    test.setTimeout(300_000);
    const errors = collectConsoleErrors(page);
    await login(page, HR);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/hr", "/hr/dziennik", "/hr/lustro", "/asystent"]) {
        await page.goto(path);
        await expectGoodScreen(page, `${path} @ ${width}px`);
      }
    }
    expect(errors, "błędy w konsoli").toEqual([]);
  });
});
