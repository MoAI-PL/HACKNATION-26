import { defineConfig, devices } from "@playwright/test";

// Testy end-to-end (Z30): ścieżka demo w przeglądarce, dostępność (axe, WCAG 2.1 A/AA) i pomiar czasu oceny.
// Uruchomienie: `npm run e2e` – serwer deweloperski startuje sam albo używany jest już działający (`npm run dev`).
// Przed testami global-setup przywraca dane demo (seed) – testy zmieniają dane (sporządzają ocenę, zapisują rozmowę).
// Pliki są numerowane i biegną po kolei: 04 sporządza ocenę Katarzyny Wójcik, więc wcześniejsze testy muszą ją widzieć „w ocenie”.

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  // Wspólna baza danych – testy po kolei.
  workers: 1,
  fullyParallel: false,
  // Serwer deweloperski kompiluje stronę przy pierwszym wejściu – stąd hojne limity.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
