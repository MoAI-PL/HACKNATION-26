# Kompas Kompetencji

**Ocena oparta na zachowaniach, nie na wrażeniach.**

Aplikacja prowadzi przełożonego w służbie cywilnej krok po kroku przez pierwszą ocenę i ocenę okresową (arkusze B i C): od analizy opisu stanowiska, przez wybór kryteriów i dziennik obserwacji, po ocenę opartą na 49 wskaźnikach behawioralnych modelu kompetencji. System proponuje poziom kompetencji i wyjaśnia, skąd się wziął, ale decyzję zawsze podejmuje przełożony. Wynik, terminy i formularz PDF liczone są zgodnie z rozporządzeniami.

Projekt powstaje podczas HackNation 2026 w ramach zadania Ministerstwa Cyfryzacji (Biuro Dyrektora Generalnego) „Kompas Kompetencji”.

## Stan

Prace w toku – postęp na tablicy zadań: [`docs/ZADANIA.md`](docs/ZADANIA.md).

## Struktura repozytorium

```
materialy/          materiały źródłowe od organizatora (tylko do odczytu)
  zadanie/          treść i regulamin zadania
  ocena-okresowa/   arkusze B i C, poradnik, rozporządzenie z 2016 r.
  pierwsza-ocena/   arkusz, poradnik, rozporządzenie z 2015 r.
  OSP/              przykładowe opisy stanowisk pracy
docs/               tablica zadań, założenia, dokumentacja
```

## Publiczne demo

Adres demo: _(uzupełnić po wdrożeniu)_. Wdrożenie: Vercel + Neon – instrukcja w [`docs/WDROZENIE.md`](docs/WDROZENIE.md).

## Uruchomienie lokalne

Wymagania: Node.js 20+, Docker.

1. `npm install`
2. `cp .env.example .env` (na Windows: `copy .env.example .env`) i uzupełnij `AUTH_SECRET` (dowolny losowy ciąg, np. wynik `npx auth secret`)
3. `npm run db:up` – uruchamia PostgreSQL w Dockerze
4. `npm run db:migrate` i `npm run seed`
5. `npm run dev` – aplikacja pod http://localhost:3000

## Konta demo

Przy `DEMO_MODE="true"` ekran logowania pokazuje karty kont demo – wystarczy kliknąć „Zaloguj jako…”. Dane są fikcyjne.

| Rola | E-mail | Hasło |
|---|---|---|
| Przełożona (Ewa Kowalczyk) | `ewa.kowalczyk@demo.kompas.test` | `Kompas2026!` |
| HR / administrator | `hr@demo.kompas.test` | `Kompas2026!` |
| Oceniany | `jan.nowak@demo.kompas.test` | `Kompas2026!` |
| Kierujący komórką | `kierujacy@demo.kompas.test` | `Kompas2026!` |

Konta i dane demo tworzy `npm run seed` (można uruchamiać wielokrotnie – dane demo są odtwarzane od nowa, daty liczone od dnia uruchomienia).

**Scenariusze w danych demo** (wszystkie osoby fikcyjne, stanowiska z OSP dostarczonych przez MC):

| Osoba | Stanowisko | Scenariusz |
|---|---|---|
| Katarzyna Wójcik | radca (arkusz C) | ocena za kilka dni, 10 obserwacji w dzienniku – główna ścieżka oceny wskaźników |
| Piotr Lewandowski | naczelnik wydziału (arkusz B) | okres oceny, kryteria dodatkowe z OSP |
| Jan Nowak (konto ocenianego) | starszy specjalista (arkusz C) | L4 44 dni wydłuża termin; większość notatek z ostatniego miesiąca |
| Marcin Wróbel | starszy specjalista (arkusz C) | po ocenie negatywnej – ponowna ocena po 6 miesiącach |
| Aleksandra Mazur | starszy specjalista | nowa pracownica – pierwsza ocena, rozmowa wstępna w 21 dni |
| Marta Kamińska | radca (arkusz C) | zatrudniona na czas nieokreślony – ocena do rozpoczęcia od OSP |
 Na produkcji ustaw `DEMO_MODE="false"` – karty i logowanie jednym kliknięciem znikają.

## Skrypty

| Polecenie | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm test` | testy (Vitest) |
| `npm run typecheck` / `npm run lint` | kontrola typów / lint |
| `npm run build` | build produkcyjny |
| `npm run seed` | dane demo |
| `npm run wiedza` | buduje bazę wiedzy asystenta z PDF-ów (`data/wiedza/fragmenty.json`) |
| `npm run eval` | zestaw testowy asystenta formalnego |
| `npm run osp -- plik.docx` | podgląd importu opisu stanowiska pracy: co system odczyta i jaki arkusz (B/C) wybierze |
| `npm run model` | import modelu kompetencji: `materialy/Model_kompetencji.xlsx` → `data/model-kompetencji.json` (`-- --check` sprawdza aktualność) |
| `npm run db:up` / `db:migrate` / `db:generate` | baza danych: start, migracje, klient Prisma |

## Materiały źródłowe

Pliki w `materialy/` pochodzą od organizatora zadania (Ministerstwo Cyfryzacji) i zostały udostępnione na potrzeby hackathonu.
