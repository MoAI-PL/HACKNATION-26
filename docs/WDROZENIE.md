# Publiczne demo – wdrożenie (Z29)

Demo: **Vercel** (aplikacja Next.js, darmowy plan Hobby, logowanie kontem GitHub, bez karty płatniczej) + **Neon** (PostgreSQL, darmowy plan, podłączany jednym kliknięciem z poziomu Vercela). Na demo są wyłącznie dane fikcyjne.

## Jak to działa

- Adres demo: **https://sprawdz-my-kompetencje.vercel.app** (nazwa projektu: sprawdz.my.kompetencje). Poprzedni adres `hacknation-26.vercel.app` wskazuje na to samo wdrożenie – stare linki działają.

- `vercel.json` ustawia build na `node scripts/build-produkcja.mjs`.
- **Wdrożenie produkcyjne** (gałąź `main`): `prisma migrate deploy` → `npm run seed` (konta i dane demo od nowa, daty liczone od dnia wdrożenia) → `next build`. Migracje i seed idą połączeniem bezpośrednim (`DATABASE_URL_UNPOOLED` z integracji Neon), aplikacja – pulą połączeń (`DATABASE_URL`).
- **Wdrażana jest tylko gałąź `main`.** `git.deploymentEnabled` w `vercel.json` sprawia, że push na inną gałąź w ogóle nie tworzy wdrożenia (nie liczy się do limitu). Dodatkowo `ignoreCommand` uruchamia [`scripts/vercel-ignore.sh`](../scripts/vercel-ignore.sh): pomija build gałęzi innej niż `main` (zabezpieczenie dla starszych gałęzi, ta sama reguła jest w **Settings → Build and Deployment → Ignored Build Step**) oraz push, który od ostatniego wdrożenia zmienił tylko `docs/`, `README.md`, `e2e/` albo `tests/`. Przy każdej wątpliwości skrypt buduje, żeby nie zablokować produkcji; pierwsza linia logu buildu pokazuje jego decyzję. Gdyby ktoś wdrożył gałąź ręcznie, `build-produkcja.mjs` i tak nie dotknie bazy (tylko `VERCEL_ENV=production`).
- `DEMO_MODE="true"` jest w `.env.production` (to nie sekret). Każde wdrożenie `main` przywraca dane demo do stanu początkowego; wyłączenie: zmienna `SEED_ON_DEPLOY=false`.

### Limity planu Hobby (stan z 22.11.2026)

| Limit | Hobby | Co to oznacza dla nas |
|---|---|---|
| Wdrożenia dziennie | **100** | 21–22.11 wyczerpaliśmy go w ok. 11 godzin (każdy push na `main` i na gałąź = osobne wdrożenie) – kolejne pushe nie dawały wdrożenia, a produkcja zostawała na starej wersji |
| Buildy naraz | **1** | pushe kilku osób ustawiają się w kolejce; build trwa ok. 1,5 min (produkcja ma pierwszeństwo – „Prioritize Production Builds”) |
| Czas buildu | 45 min | build trwa ok. 1,5 min |
| Active CPU funkcji | 4 h / mies. | zużyte ok. 3 min |
| Wywołania funkcji | 1 mln / mies. | zużyte ok. 2,6 tys. |

Po przekroczeniu limitu miesięcznego Vercel wstrzymuje funkcję do końca 30 dni – demo przestałoby działać. Limit dzienny jest kroczący (24 godziny).

**Zasady pushowania (żeby nie przekroczyć limitu):**
1. Na `main` pushujemy rzadziej, paczką: kilka commitów lokalnie, potem jeden `git push` (Vercel buduje tylko ostatni commit z pushu).
2. „Biorę zadanie” i inne zmiany samej dokumentacji nie uruchamiają już buildu, ale każdy push na `main` nadal tworzy wpis wdrożenia – łączymy je z commitem z kodem.
3. Gałęzie pushujemy bez obaw – nie są wdrażane. Sprawdzamy lokalnie: `npm run typecheck`, `npm test`, `npm run build`.
4. Na czas prezentacji przed jury – żadnych pushy na `main` (podmiana wersji w trakcie może dać jednorazowy błąd strony).

## Krok po kroku (ok. 10 minut)

### 1. Projekt w Vercelu
1. Wejdź na vercel.com → **Sign Up** → **Continue with GitHub** (plan Hobby).
2. **Add New… → Project** → przy repozytorium `MoAI-PL/HACKNATION-26` kliknij **Import** (jeśli go nie widać: „Adjust GitHub App Permissions” i dodaj organizację MoAI-PL albo samo repozytorium).
3. Kliknij **Deploy**. Pierwsze wdrożenie **zakończy się błędem „Brak DATABASE_URL”** – to oczekiwane, baza dochodzi w kroku 2.

### 2. Baza danych – Neon z poziomu Vercela
1. W projekcie: zakładka **Storage** → **Create Database** → **Neon** (Serverless Postgres) → Continue.
2. Region: **Frankfurt (eu-central-1)**, plan **Free** → zaakceptuj → **Create**.
3. **Connect Project** → wybierz ten projekt, środowiska: Production (i Preview). Vercel sam doda zmienne `DATABASE_URL` i `DATABASE_URL_UNPOOLED` – niczego nie kopiujesz.

### 3. Sekret logowania
1. Na swoim komputerze w PowerShell wygeneruj losowy sekret i skopiuj go do schowka (nie pojawia się na ekranie):
   ```powershell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 })) | Set-Clipboard
   ```
2. W projekcie: **Settings → Environment Variables** → Key: `AUTH_SECRET`, Value: wklej (Ctrl+V), środowisko: Production → **Save**.
3. Opcjonalnie: `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` (darmowy dostawca zgodny z API OpenAI – przykłady w `.env.example`). Bez nich asystent działa w trybie bez AI.

### 4. Wdrożenie
**Deployments** → ostatnie wdrożenie → **⋯ → Redeploy**. W logu powinny być `All migrations have been successfully applied` i `Seed: dane demo na dzień …`. Adres demo: `https://<nazwa-projektu>.vercel.app`.

## Sprawdzenie (w oknie prywatnym przeglądarki)
- adres główny przekierowuje na `/logowanie` z kartami kont demo;
- „Zaloguj jako Ewa Kowalczyk” → pulpit; `/asystent` odpowiada ze źródłami;
- „Zaloguj jako Jan Nowak” → `/moje-oceny`; `/api/asystent/formalny` zwraca 403;
- `/api/v1/status` zwraca `{"status":"ok"}`.

Adres demo wpisz do README i do zgłoszenia w HackTribe.

## Zasady bezpieczne dla demo
- Wdrażamy wcześnie i sprawdzamy po każdym wdrożeniu `main`.
- Po wysłaniu zgłoszenia – żadnych pushy (demo się nie zmieni i nie zresetuje).
- Zapas: film z przejściem ścieżki i zrzuty ekranu w zgłoszeniu.
- Plan awaryjny: laptop z `npm run build && npm start` i publiczny tunel – tylko w ostateczności (laptop musi być włączony do końca oceny).
- **Reset danych demo bez wdrożenia (Z44):** konto HR (Anna Zielińska) → Panel HR → sekcja „Tryb demo” → „Resetuj dane demo”. Przywraca dane z terminami od dzisiaj, konta zostają. Dobre przed pitchem i po testach jury. Działa tylko przy `DEMO_MODE=true`; strona ma `maxDuration = 60` (zapis kilkudziesięciu rekordów do Neon).
- **Zapasowe odpowiedzi AI (Z44):** gdy model jest skonfigurowany, ale nie odpowie na scenie (limit, czas), pytania z pitchu i propozycje kryteriów dla trzech OSP od MC biorą się z `data/demo-cache.json` – z komunikatem „odpowiedź przygotowana wcześniej dla demo” i wpisem `[demo-cache]` w logach Vercela.
