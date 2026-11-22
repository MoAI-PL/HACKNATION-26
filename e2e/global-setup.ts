// Przed testami end-to-end: świeże dane demo (konta, pracownicy, oceny, obserwacje), żeby każde uruchomienie
// zaczynało od tego samego stanu. Pomijane przy E2E_BASE_URL (testy na wdrożonej wersji – nie ruszamy jej bazy)
// albo przy E2E_BEZ_RESETU=1 (ręcznie przygotowane dane).
import { execSync } from "node:child_process";

export default function globalSetup() {
  if (process.env.E2E_BASE_URL || process.env.E2E_BEZ_RESETU === "1") return;
  execSync("npm run seed", { stdio: "inherit" });
}
