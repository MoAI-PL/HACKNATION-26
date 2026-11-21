# Bezpieczeństwo i ochrona danych

Ocena okresowa to dane osobowe pracownika (ocena jego pracy, nieobecności, uzasadnienia). Prototyp jest zaprojektowany tak, żeby te dane widziały wyłącznie osoby, które muszą, a każda decyzja była odtwarzalna.

## Uwierzytelnianie

- **Auth.js (next-auth v5)**, logowanie e-mailem i hasłem (`src/auth.ts`, `src/lib/auth/credentials.ts`).
- Hasła przechowywane wyłącznie jako **skrót bcrypt** (koszt 10, `bcryptjs`).
- **Sesja JWT w ciasteczku httpOnly** (niedostępnym dla JavaScriptu strony), ważna 8 godzin; na demo przez HTTPS. Sekret podpisu (`AUTH_SECRET`) tylko w zmiennych środowiskowych.
- Ten sam komunikat przy złym e-mailu i złym haśle – logowanie nie zdradza, które konta istnieją.
- Adres powrotu po zalogowaniu przyjmowany tylko jako ścieżka wewnętrzna, do której rola ma dostęp (ochrona przed przekierowaniem na obcą stronę).
- Każde logowanie zapisywane w dzienniku zdarzeń (`AuditLog`, `LOGOWANIE`).

## Role i autoryzacja

| Rola | Dostęp |
|---|---|
| Przełożony | wyłącznie **swoi podwładni**: pulpit, oceny, dziennik obserwacji, asystent |
| HR / administrator | panel HR (wszystkie oceny, terminy, przypomnienia, reset danych demo), asystent |
| Oceniany | tylko własne oceny (zapytania ograniczone do pracownika powiązanego z kontem – cudza ocena daje 404); przed sporządzeniem oceny widzi tylko część I arkusza; potwierdza zapoznanie się wyłącznie z własną oceną czekającą na zapoznanie; brak dostępu do ekranów i API innych ról |
| Kierujący komórką | asystent; rola przygotowana do podpisu arkusza pierwszej oceny |

**Trzy warstwy ochrony** – ukrycie przycisku nie jest zabezpieczeniem:

1. **Middleware** (`src/middleware.ts`) – niezalogowany trafia na logowanie, wejście na ekran innej roli przekierowuje na własny.
2. **Ekrany** – układy grup ról sprawdzają rolę na serwerze (`requirePageRole`).
3. **Każdy handler API i każda akcja serwerowa** sprawdza rolę sama (`withRole`, `requireRole` w `src/lib/auth/guard.ts`) i zakres danych: zapytania przełożonego są zawsze ograniczone do jego podwładnych (`Employee.supervisorId`), a cudza ocena lub obserwacja wygląda jak nieistniejąca (404). Bez sesji API zwraca **401**, przy złej roli **403** – z komunikatem po polsku.

Sprawdzone testami (`tests/auth/`, testy akcji ekranów) i ręcznie na demo: oceniany wywołujący API asystenta lub listy pracowników dostaje 403, wywołanie bez sesji – 401.

## Walidacja danych wejściowych

- **zod** na wejściu każdego endpointu i każdej akcji serwerowej (pytania do asystenta: 3–500 znaków; oceny wskaźników tylko 1–5 albo „brak obserwacji”; decyzja przełożonego tylko ze skali; uzasadnienie wymagane, gdy przepis tego wymaga).
- **Pliki od użytkownika** (OSP .docx, model kompetencji .xlsx): limit rozmiaru (OSP do 5 MB, do 50 MB po rozpakowaniu), odrzucenie XML z `DOCTYPE` (ochrona przed atakami XXE i „bombami” XML), odczyt tylko części dokumentu wskazanych w jego relacjach.
- Akcje serwerowe Next.js sprawdzają pochodzenie żądania (ochrona przed CSRF); logowanie Auth.js ma własny token CSRF.

## Ochrona danych osobowych

- **Minimalizacja:** nie zbieramy numerów PESEL, adresów ani danych kontaktowych pracowników – tylko pola potrzebne do arkusza oceny.
- **Dane demo są w całości fikcyjne**; opisy stanowisk pochodzą z materiałów MC (bez danych osobowych).
- **Do modelu AI nie trafiają dane osobowe pracowników:** asystent formalny wysyła pytanie o procedurę i fragmenty przepisów; analiza OSP – treść opisu stanowiska (cel, zadania, kompetencje), bez imion i nazwisk. Opis przepływu danych: [`AI.md`](AI.md).
- **Lokalizacja danych na demo:** baza danych i aplikacja w regionie Frankfurt (UE). Docelowo – baza i model lokalny w infrastrukturze urzędu.
- **Rozliczalność:** dziennik decyzji (`AuditLog`) zapisuje propozycję AI obok decyzji człowieka, zmiany sugerowanego poziomu z powodem, zmiany arkusza, wysłane przypomnienia, reset danych demo; dziennik zapytań asystenta (`AssistantQuery`) – pytanie, użyte źródła, odpowiedź, model, czas i użytkownika.

## Bezpieczeństwo AI

- **Prompt injection:** treść przepisów, OSP i pytania trafia do modelu jako dane w znacznikach, ze zneutralizowanymi znakami `<` `>`; prompt nakazuje ignorować polecenia w danych. W zestawie testowym próba „zignoruj zasady…” kończy się odmową.
- **Halucynacje:** odpowiedź asystenta bez poprawnego źródła jest traktowana jak odmowa; przepis wymieniony w odpowiedzi, a nieobecny w źródłach, daje ostrzeżenie; cytat z OSP w propozycji kryteriów musi być dosłownym fragmentem dokumentu.
- **AI nie podejmuje decyzji:** propozycje są oznaczone, wymagają kliknięcia „Wstaw” i trafiają do dziennika.
- **Limity zapytań** do AI na użytkownika; awaria modelu nie blokuje aplikacji.

## Sekrety i konfiguracja

- Sekrety (`AUTH_SECRET`, `DATABASE_URL`, `LLM_API_KEY`) wyłącznie w zmiennych środowiskowych; w repozytorium (publicznym) jest tylko `.env.example` bez wartości, a `.env` jest w `.gitignore`.
- Na demo sekrety przechowuje hosting jako zmienne typu „Secret” (niewidoczne po zapisaniu).
- `DEMO_MODE=true` włącza karty kont demo i reset danych – na produkcji musi być `false`.

## Zależności

- Wyłącznie licencje permisywne, bez GPL/AGPL ([`LICENCJE.md`](LICENCJE.md)).
- Import xlsx i docx własnym czytnikiem zamiast bibliotek ze znanymi podatnościami (uzasadnienie w [`ARCHITEKTURA.md`](ARCHITEKTURA.md)).

## Przed wdrożeniem produkcyjnym

- logowanie przez katalog urzędu (SSO / Active Directory / login.gov.pl) zamiast haseł w aplikacji; uwierzytelnianie wieloskładnikowe dla HR;
- `DEMO_MODE=false`, rotacja `AUTH_SECRET`, usunięcie kont demo;
- model AI lokalny w infrastrukturze urzędu; przy modelu zewnętrznym – umowa powierzenia i pseudonimizacja;
- nagłówki bezpieczeństwa (CSP, HSTS) na reverse proxy, limit zapytań we współdzielonym magazynie (np. Redis);
- polityka retencji danych ocen zgodna z przepisami o aktach osobowych, kopie zapasowe bazy, monitoring i alerty;
- test penetracyjny i przegląd uprawnień przez inspektora ochrony danych; rejestr czynności przetwarzania (RODO).
