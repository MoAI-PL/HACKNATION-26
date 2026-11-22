# Publiczne demo – wdrożenie (Z29)

Demo: **Vercel** (aplikacja Next.js, darmowy plan Hobby, logowanie kontem GitHub, bez karty płatniczej) + **Neon** (PostgreSQL, darmowy plan, podłączany jednym kliknięciem z poziomu Vercela). Na demo są wyłącznie dane fikcyjne.

## Jak to działa

- `vercel.json` ustawia build na `node scripts/build-produkcja.mjs`.
- **Wdrożenie produkcyjne** (gałąź `main`): `prisma migrate deploy` → `npm run seed` (konta i dane demo od nowa, daty liczone od dnia wdrożenia) → `next build`. Migracje i seed idą połączeniem bezpośrednim (`DATABASE_URL_UNPOOLED` z integracji Neon), aplikacja – pulą połączeń (`DATABASE_URL`).
- **Inne gałęzie nie są wdrażane.** `ignoreCommand` w `vercel.json` buduje tylko gałąź `main` (a gdy Vercel nie poda nazwy gałęzi – też buduje, żeby nie zablokować produkcji); pozostałe wdrożenia dostają status „Canceled” i nie zużywają limitu buildów planu Hobby. Pierwsza linia logu buildu pokazuje gałąź i środowisko. Gałąź utworzona przed tą zmianą ma starszy `vercel.json` – dlatego ta sama komenda jest też w **Settings → Build and Deployment → Ignored Build Step** (Custom). Gdyby ktoś wdrożył gałąź ręcznie, `build-produkcja.mjs` i tak nie dotknie bazy (tylko `VERCEL_ENV=production`).
- `DEMO_MODE="true"` jest w `.env.production` (to nie sekret). Każde wdrożenie `main` przywraca dane demo do stanu początkowego; wyłączenie: zmienna `SEED_ON_DEPLOY=false`.

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
