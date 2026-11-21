# Architektura

> Dokument rozwijany w trakcie prac. Pełny opis (diagram, model danych, API, wdrożenie i skalowanie) uzupełnia Z31.

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Aplikacja (interfejs + API) | Next.js 15 (App Router), TypeScript w trybie ścisłym |
| Interfejs | Tailwind CSS 4, shadcn/ui (Radix), lucide-react |
| Walidacja | zod – wejście każdego endpointu i formularza |
| Baza danych | PostgreSQL 16 przez Prisma 6 |
| Testy | Vitest (logika, silnik reguł), Playwright (główna ścieżka) |

## Decyzje

| Data | Decyzja | Powód |
|---|---|---|
| 21.11 | **PostgreSQL** lokalnie przez `docker compose`, na demo darmowa instancja zarządzana (np. Neon) | jedna baza w dev i na demo, gotowa pod wdrożenie w urzędzie; SQLite zostaje jako plan awaryjny |
| 21.11 | Prisma 6 (nie 7) | stabilna konfiguracja bez adapterów sterowników, mniej ryzyka w 16 godzin |
| 21.11 | Import xlsx własnym czytnikiem (`fflate` + `fast-xml-parser`) zamiast SheetJS / exceljs | plik MC zapisany przez Open XML SDK używa prefiksów przestrzeni nazw (`<x:c>`), których exceljs nie czyta; SheetJS w rejestrze npm (0.18.5) ma znane podatności. Potrzebujemy tylko tekstu komórek – ok. 160 linii kodu z testami |
| 21.11 | Import OSP własnym czytnikiem docx zamiast mammoth | OSP to formularz z polami wyboru (☒/☐), od których zależy arkusz oceny; mammoth zamienia dokument na HTML i gubi stan pól. Czytnik korzysta z tych samych `fflate` + `fast-xml-parser` co import xlsx |
| 21.11 | Jedna aplikacja Next.js zamiast osobnego backendu | szybsza praca zespołu, jeden deploy; API REST pod `/api/v1` gotowe do integracji z EZD i systemem kadrowym |

## Baza danych – zasady pracy

- Zmiana schematu = nowa migracja: `npx prisma migrate dev --name krotka_nazwa`. Nie edytujemy ani nie przemianowujemy migracji, które są już na `main`.
- Migracje wykonują się w kolejności nazw (znacznik czasu UTC). Migracja początkowa ma znacznik `20261121160000`, więc migracja utworzona przed 17:00 czasu polskiego 21.11 dostałaby wcześniejszą nazwę i wykonałaby się przed `init`. Taką migrację trzeba przemianować na późniejszy znacznik.
- Daty kalendarzowe (`@db.Date`) zapisujemy i odczytujemy przez `toDbDate` / `fromDbDate` z `src/lib/domain/daty.ts`, a dzisiejszą datę bierzemy z `todayIso()`. `new Date(rok, miesiąc, dzień)` w czasie lokalnym zapisze w bazie poprzedni dzień.
- Testy integracyjne modelu danych (`tests/db/`) uruchamiają się z `TEST_DATABASE_URL` wskazującym osobną, pustą bazę z zastosowanymi migracjami (`npx prisma migrate deploy`).

## Uwierzytelnianie i role (Z04)

- **Auth.js (next-auth v5)**, logowanie e-mailem i hasłem. Hasła hashowane bcrypt, sesja JWT w ciasteczku httpOnly (8 godzin).
- Role: `PRZELOZONY`, `HR`, `OCENIANY`, `KIERUJACY_KOMORKA` – jedna rola na konto.
- Ekrany ról i ich ścieżki: `src/lib/auth/role.ts` (`ROLE_HOME`, `PROTECTED_AREAS`). Nowy ekran roli = nowy wpis w `PROTECTED_AREAS`.
- **Trzy warstwy ochrony:**
  1. `src/middleware.ts` – niezalogowany trafia na `/logowanie`, ekran innej roli przekierowuje na własny;
  2. układy grup `(przelozony)`, `(hr)`, `(oceniany)`, `(kierujacy)` – `requirePageRole(...)` na serwerze;
  3. **każdy handler API i akcja serwerowa** sprawdza rolę sam (`src/lib/auth/guard.ts`). Bez sesji API zwraca 401, przy złej roli 403.

Jak zabezpieczyć nowy kod:

```ts
// handler API
export const GET = withRole(["HR", "PRZELOZONY"], async (req, ctx, user) => { … });

// akcja serwerowa
const user = await requireRole("PRZELOZONY"); // rzuca AccessError 401/403

// ekran (server component) – zwykle wystarczy layout grupy
const user = await requirePageRole("HR");
```

Przełożony widzi wyłącznie swoich podwładnych: zapytania filtrujemy po `supervisorId: user.id` (przykład: `/api/v1/pracownicy`).

## Model kompetencji (Z05)

- `npm run model` czyta `materialy/Model_kompetencji.xlsx` i zapisuje `data/model-kompetencji.json` (plik jest w repozytorium; aplikacja nie czyta xlsx w czasie działania). `npm run model -- --check` kończy się kodem 1, gdy JSON nie odpowiada plikowi xlsx; to samo sprawdza test.
- Data importu zmienia się tylko przy zmianie treści, więc ponowny import tego samego pliku nie daje zmian w git.
- Import jest ścisły: sprawdza nagłówki (wiersz 3), komplet 5 opisów zachowań w każdym wierszu, zgodność liczby wskaźników ze spisem w arkuszu „Model kompetencji” i z deklaracją „14 kompetencji • 49 wskaźników • 5 poziomów”, tytuły arkuszy, duplikaty i treść poniżej pustego wiersza. Zbiera wszystkie problemy naraz i podaje adres komórki, np. `„KOMUNIKACJA”!D3: oczekiwano nagłówka „na poziomie oczekiwań”…`. Ten sam kod może przyjąć nowy plik w panelu HR (Z19).
- Wynik: 14 kompetencji, 49 wskaźników, po 5 opisów zachowań i 3 wskazówki do oceny (`guidance`, do wyświetlenia przy ocenie w Z14). Nazwy wskaźników są identyczne z załącznikiem nr 1 do rozporządzenia – pilnuje tego test na danych przepisanych z PDF (`tests/import/zalacznik-1.ts`).
- Identyfikator wskaźnika: `KOD.numer` w kolejności z arkusza, np. `KOMUNIKACJA.2` (patrz `docs/ZALOZENIA.md` #15).
- Użycie w kodzie:
  ```ts
  import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
  competencyModel.getCompetency("WSPOLPRACA").indicators; // 6 wskaźników
  competencyModel.getIndicator("KOMUNIKACJA.2")?.name;
  competencyModel.behaviorDescription("KOMUNIKACJA.2", 3); // opis karty „na poziomie oczekiwań”
  competencyModel.model.guidance; // wskazówki do oceny
  ```
- Schemat zod `competencyModelSchema` (`src/lib/domain/model-kompetencji.ts`) waliduje JSON przy starcie aplikacji, wynik importu i – w Z19 – edycję opisów zachowań w panelu HR.
- Czytnik `src/lib/import/xlsx.ts` (dla plików od użytkownika): limit 50 MB po rozpakowaniu, odrzucenie XML z `DOCTYPE`, odczyt tylko części wskazanych w relacjach skoroszytu.

## Import opisu stanowiska pracy i wybór arkusza (Z06)

- `parseOsp(plik)` z `src/lib/import/osp.ts` zwraca `PositionDescription`, automatyczny wybór arkusza (`sheet`), kandydatów na kryteria dodatkowe, pełny tekst (`rawText`, do `Position.rawText` i jako kontekst dla AI w Z23) oraz uwagi. Podgląd z wiersza poleceń: `npm run osp -- plik.docx`.
- Odczytywane pola: nazwa stanowiska, urząd, komórka (departament i wydział), symbol, stanowisko bezpośrednio nadzorujące, cel istnienia stanowiska, zadania dominujące i pozostałe (bez przedrostka „Zadanie N:”), liczba podległych, zaznaczone upoważnienia (z opisem „inne”), opisy złożoności i samodzielności, wymagana wiedza i „Kompetencje miękkie” zamienione na kody z modelu kompetencji.
- Sekcje szukamy po nagłówkach formularza, a nie po numerach wierszy, więc OSP z inną liczbą zadań lub dodatkowymi wierszami też się wczyta. Błąd importu tylko wtedy, gdy nie da się wybrać arkusza (brak sekcji, żadna albo kilka zaznaczonych opcji liczby podległych) albo brak nazwy stanowiska; braki w pozostałych sekcjach to uwagi.
- Wybór arkusza: `selectSheet(liczbaPodległych)` z `src/lib/rules/arkusz.ts` według `periodic.sheetBySubordinates` w `data/przepisy.json` (§ 3). Zwraca arkusz, kryteria obowiązkowe (§ 4) i wyjaśnienie, np. „Wybrano arkusz C, bo w OSP zaznaczono »brak podległych pracowników«”. Zmianę arkusza przez przełożonego zapisuje Z12 w dzienniku decyzji.
- `additionalCriteriaFromOsp`: kompetencje miękkie z OSP, które nie są obowiązkowe na wybranym arkuszu (np. starszy specjalista → Myślenie analityczne) – podpowiedź bez AI dla Z12 i punkt wyjścia dla Z23.
- Czytnik `src/lib/import/docx.ts` obsługuje pola wyboru Worda 2010+ (`w14:checkbox`), stare pola formularza (FORMCHECKBOX), znaki ☒/☐ i symbole Wingdings; pomija teksty zastępcze pustych kontrolek („Wybierz element.”). Wspólne zabezpieczenia plików od użytkownika (limit 50 MB, odrzucenie DOCTYPE) są w `src/lib/import/ooxml.ts`.

## Analiza OSP: propozycja kryteriów dodatkowych (Z23)

- `proposeAdditionalCriteria(stanowisko, arkusz)` z `src/lib/ai/funkcje/kryteria-z-osp.ts` zwraca `{ mode: "AI" | "BEZ_AI", proposals: [{ competency, name, justification, quote: { text, source, taskNumber } }], notice? }`. Zabezpieczenia opisuje `docs/AI.md`.
- Endpoint `POST /api/asystent/kryteria`: `multipart/form-data` z polem `plik` (OSP .docx, do 5 MB) albo JSON `{ pracownikId }` (OSP z bazy); opcjonalnie `arkusz` = `B` | `C`, gdy przełożony zmienił arkusz wskazany przez OSP. Odpowiedź: `propozycja`, `arkusz` (wybór z OSP z wyjaśnieniem i polem `wybrany`), `stanowisko`, `uwagi` z importu.
- Błędy: 400 (brak pliku/pracownika, zły arkusz), 404 (pracownik spoza podwładnych przełożonego), 409 (pracownik bez OSP), 413 (plik za duży), 422 (plik nie jest poprawnym OSP – lista `problemy`), 429 (limit zapytań).
- Interfejs (Z12) pokazuje propozycje w `<PropozycjaAI>` z przyciskiem „Wstaw do formularza”; gdy `mode = "BEZ_AI"`, etykieta mówi, że to propozycja bez AI.

## Sugerowany poziom kompetencji (Z09)

- `suggestLevel(kompetencja, oceny, { evaluationType })` z `src/lib/rules/sugestia.ts` – czysta funkcja, parametry z `data/przepisy.json` (`behaviorToPoints`, `suggestion`), wskaźniki z modelu kompetencji (Z05).
- Wejście: oceny wskaźników `{ indicatorId, value: 1–5 | "BRAK_OBSERWACJI" | null, hasNote }` (null = jeszcze nieoceniony).
- Wynik (`LevelSuggestion`): `suggestedPoints` i `suggestedLevel` (albo null = brak podstaw), średnia, flaga remisu, rozkład wyborów, wiersze wskaźników do panelu „Dlaczego ten poziom?”, wyjaśnienia zwykłym językiem (wzór, zaokrąglenie) i ostrzeżenia ze stałymi kodami: `OCENA_1_PKT`, `BRAK_NOTATKI` (z `indicatorId`, do pokazania przy karcie), `NISKA_WIARYGODNOSC`, `SUGESTIA_1_PKT`, `REMIS_W_DOL`, `NIEOCENIONE_WSKAZNIKI`, `BRAK_PODSTAW`.
- `validateFinalDecision({ suggestion, finalPoints, justification })` – ocena ze skali, a przy różnicy od sugestii wymagane jedno zdanie powodu; `differsFromSuggestion` mówi, kiedy zapisać oba wpisy w dzienniku decyzji (Z14, Z35).
- Zaokrąglenie liczone na liczbach całkowitych (|suma − wartość × n|), więc remis 6,00 nie zależy od błędów liczb zmiennoprzecinkowych.

## Baza wiedzy asystenta formalnego (Z21)

- `npm run wiedza` czyta PDF-y z `materialy/` i zapisuje `data/wiedza/fragmenty.json` (plik jest w repozytorium, więc aplikacja nie potrzebuje PDF-ów w czasie działania).
- Podział: rozporządzenia według § i ustępów, załącznik nr 1 według kryteriów / elementów oceny, wzory arkuszy według części i pouczenia; poradniki KPRM według rozdziałów ze spisu treści (kawałki do ok. 1200 znaków); FAQ zespołu z `data/wiedza/faq.json`; model kompetencji z `data/model-kompetencji.json` (49 fragmentów, po jednym na wskaźnik; po zmianie modelu uruchom ponownie `npm run wiedza`).
- Metadane fragmentu: dokument, jednostka redakcyjna lub rozdział, strona, data aktu, publikator, plik źródłowy.
- Wyszukiwanie: `searchKnowledge(pytanie)` z `src/lib/ai/rag/search.ts` – BM25 (MiniSearch), bez polskich znaków, rdzeń słowa = 6 pierwszych liter. Zwraca `hits` i `sufficient`: przy `false` asystent ma odmówić („Nie znalazłem tej informacji w dostępnych źródłach…”). Progi (`MIN_COVERAGE`, `MIN_SCORE`) są oznaczone jako założenie do strojenia w Z25.
- `citation(fragment)` daje gotowy opis źródła, np. „§ 5 ust. 2 – rozporządzenie o ocenach okresowych (Dz.U. 2016 poz. 470)”.
- Ustawy o służbie cywilnej nie ma jeszcze w bazie (brak w `materialy/`). Treść art. 81 i 83 jest dostępna pośrednio przez poradnik KPRM, pouczenie w arkuszach i FAQ.

## Pulpit przełożonego (Z11)

- `src/lib/dashboard/pulpit.ts` – czysta logika: otwarte terminy przełożonego według etapu bieżącej oceny (silnik Z08), karta „Do zrobienia” (3–5 spraw), lista podwładnych, wejścia w ścieżki. Testy: `tests/dashboard/`.
- `src/lib/dashboard/dane.ts` – odczyt z bazy, wyłącznie podwładni zalogowanego przełożonego (`Employee.supervisorId`); cudzy pracownik = 404.
- `src/lib/dashboard/actions.ts` – szybkie dodanie pracownika (zod, rola sprawdzana na serwerze, wpis w AuditLog) i podgląd pliku OSP (parser Z06).
- Linki z pulpitu prowadzą tylko do gotowych ekranów: `isScreenReady` w `src/lib/ui/nav.ts` sprawdza menu (`pending`). Rozmowa rozpoczynająca → kreator Z12; pozostałe sprawy → karta pracownika `/pulpit/pracownik/[id]`, dopóki Z14 i Z17 nie usuną `pending`.

**Zmiana w silniku terminów (Z08) – informacja dla właściciela Z08:** `buildTodoItems` w `src/lib/rules/terminy.ts` dopisuje rok do daty w tytule karty, gdy termin wypada w innym roku niż dzisiejszy: „termin minął 22.12.2025”, „do 05.01.2027”. W bieżącym roku format się nie zmienia („do pt. 27.11”), więc dotychczasowe testy Z08 przechodzą bez zmian. Powód: przy terminie sprzed roku sama data „22.12” była niejednoznaczna (wyszło przy dodaniu pracownika z datą zatrudnienia na czas nieokreślony sprzed roku). Ta sama zasada działa na liście pracowników na pulpicie (`formatDay` w `pulpit.ts`).

## Struktura katalogów

```
materialy/                 materiały MC (tylko do odczytu)
data/                      model kompetencji, parametry przepisów, baza wiedzy
prisma/                    schema.prisma, seed.ts, seed-dane/
src/
  app/
    (auth)/ (przelozony)/ (hr)/ (oceniany)/   ekrany według ról
    api/v1/                REST API (np. /api/v1/status)
    api/asystent/          endpointy asystentów
  components/ui/ layout/ ocena/ asystent/
  lib/
    domain/                typy i słownik (kontrakt wspólny)
    rules/                 silnik reguł: punktacja, terminy, sugestie
    auth/                  role, strażnicy autoryzacji, konta demo (Z04)
    pdf/  import/
    ai/llm/ ai/rag/ ai/funkcje/
    db.ts                  klient Prisma
scripts/                   import modelu, import wiedzy, eval asystenta
tests/rules/               testy silnika reguł
eval/                      zestaw testowy asystenta
docs/                      dokumentacja, tablica zadań
```
