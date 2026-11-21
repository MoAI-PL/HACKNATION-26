# Wykorzystanie AI w Kompasie Kompetencji

> Dokument rozwijany w trakcie prac (pełna wersja: Z31). Stan: warstwa modelu (Z20), baza wiedzy (Z21), asystent formalny (Z22), analiza OSP (Z23).

## Zasada nadrzędna

**Przepisy liczy kod, nie model językowy.** Wybór arkusza, punkty, średnie, wynik pozytywny/negatywny i terminy to deterministyczne funkcje z testami (`src/lib/rules/`). AI tylko doradza, wyszukuje i redaguje. Każda propozycja AI jest oznaczona, a decyzję podejmuje człowiek.

## Gdzie jest AI, a gdzie celowo go nie ma

| Element | AI? | Uwagi |
|---|---|---|
| Asystent formalny (pytania o procedurę) | tak | odpowiedź wyłącznie z fragmentów przepisów i poradników, zawsze ze źródłem |
| Punktacja, wynik, terminy, wybór arkusza | **nie** | silnik reguł z testami |
| Propozycja kryteriów dodatkowych z OSP (Z23) | tak | do 3 kryteriów z uzasadnieniem i cytatem zadania; kryteria i cytaty sprawdza kod, bez modelu działa propozycja ze słów kluczowych |
| Sugerowany poziom kompetencji | **nie** | średnia z wybranych opisów zachowań, wzór widoczny w panelu „Dlaczego ten poziom?” |

## Model

- Jeden interfejs `LLMProvider` (`src/lib/ai/llm/`) w formacie API OpenAI (`/chat/completions`), bez SDK dostawców.
- Konfiguracja wyłącznie w `.env` (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_TIMEOUT_MS`) – **zmiana modelu nie wymaga zmiany kodu**.
- Wariant docelowy w urzędzie: model lokalny przez Ollamę (np. Bielik, PLLuM) – dane nie opuszczają infrastruktury urzędu.
- Wariant demo: darmowy plan dostawcy zgodnego z API OpenAI; na demo wyłącznie dane fikcyjne.
- Brak modelu albo jego błąd (limit, przekroczony czas, zły klucz) **nie blokuje aplikacji**: asystent przechodzi w tryb bez AI i pokazuje pasujące fragmenty przepisów.

## Asystent formalny – jak ogranicza halucynacje

1. **Wyszukanie przed odpowiedzią:** BM25 na 357 fragmentach (rozporządzenia według § i ustępów, poradniki KPRM według rozdziałów, FAQ). Przy słabym dopasowaniu asystent odmawia **bez pytania modelu**: „Nie znalazłem tej informacji w dostępnych źródłach. Skontaktuj się z komórką kadr.”
2. **Kontekst = tylko fragmenty.** Prompt systemowy wymaga odpowiedzi wyłącznie z fragmentów, zabrania wymyślania numerów przepisów i nakazuje zgłosić „brak w źródłach”.
3. **Odpowiedź strukturalna (JSON)** z numerami użytych źródeł, walidowana schematem; jedna ponowna próba przy niezgodności.
4. **Odpowiedź bez poprawnego źródła = odmowa.** Nie pokazujemy odpowiedzi, której nie da się przypisać do fragmentu.
5. **Kontrola cytowań:** jeśli odpowiedź wymienia artykuł lub paragraf, którego nie ma w podanych fragmentach, użytkownik dostaje ostrzeżenie.
6. **Ochrona przed prompt injection:** treść fragmentów i pytania trafia do modelu jako dane w znacznikach; znaki `<` `>` są neutralizowane, więc pytanie nie może „zamknąć” znacznika ani udawać źródła. Prompt nakazuje ignorować polecenia zawarte w danych.
7. **Dziennik zapytań** (`AssistantQuery`): pytanie, użyte źródła, odpowiedź, odmowa, krok ścieżki, model, czas.
8. **Limit zapytań** na endpoint (20/min na adres) chroni darmowy limit dostawcy.

## Propozycja kryteriów dodatkowych z OSP (Z23) – jak ogranicza błędy

1. **Lista kandydatów liczona przez kod:** 14 kryteriów z załącznika nr 1 bez obowiązkowych dla arkusza (silnik kryteriów Z07). Model wybiera tylko z tej listy, podając kody.
2. **Zadania z OSP jako dane** w znacznikach `<zadanie nr="…">` (numeracja jak w OSP); znaki `<` `>` w treści OSP są neutralizowane, a prompt nakazuje ignorować polecenia w OSP.
3. **Odpowiedź JSON walidowana schematem**, jedna ponowna próba.
4. **Kontrola po odpowiedzi:** kryterium spoza listy albo obowiązkowe jest pomijane (z informacją dla użytkownika), powtórzenia usuwane, najwyżej 3 (`validateAdditionalCriteria`, § 5 ust. 2).
5. **Cytat zawsze prawdziwy:** cytat modelu musi być dosłownym fragmentem zadania (bez względu na wielkość liter i spacje). Gdy go tam nie ma, szukamy go w innych zadaniach (i poprawiamy numer zadania), a w ostateczności pokazujemy początek wskazanego zadania. Model nie może „włożyć w usta” OSP zdania, którego w nim nie ma.
6. **Bez modelu** (brak konfiguracji, błąd, limit, odpowiedź bez poprawnych kryteriów): propozycja deterministyczna – kompetencje miękkie wymienione w OSP oraz słowa kluczowe w zadaniach, z wyjaśnieniem, które słowa z którego zadania zadecydowały. Oznaczona jako propozycja bez AI.
7. Propozycja nigdy nie trafia do arkusza sama: przełożony wstawia ją przyciskiem w `<PropozycjaAI>` (Z12), a „Wstaw” i „Odrzuć” trafiają do dziennika.
8. API: `POST /api/asystent/kryteria` (plik OSP albo pracownik z bazy), tylko przełożony (własni podwładni) i HR, limit 10 zapytań na minutę na użytkownika.

## Zapasowe odpowiedzi na demo (Z44)

- Plik `data/demo-cache.json`: odpowiedzi na 4 pytania z pitchu (sprzeciw, kryteria dodatkowe, ocena negatywna, wydłużenie terminu) ze źródłami z bazy wiedzy i propozycje kryteriów dodatkowych dla trzech OSP od MC z cytatami zadań.
- Działają **tylko** przy `DEMO_MODE=true` i **tylko** gdy skonfigurowany model nie odpowiedział (błąd, limit, czas). Bez modelu aplikacja działa w zwykłym trybie bez AI.
- Każde użycie jest jawne: komunikat „Model AI jest chwilowo niedostępny – to odpowiedź przygotowana wcześniej dla demo…”, pole `fromCache: true` w odpowiedzi API i wpis `[demo-cache]` w logach serwera.
- Nic nie jest wymyślone: test sprawdza, że każde źródło istnieje w bazie wiedzy, każde pytanie przechodzi próg trafności (nie kończy się odmową) i każdy cytat jest dosłownym fragmentem wskazanego zadania z OSP, a cytaty z pliku przechodzą tę samą kontrolę `verifyQuote` co odpowiedzi modelu.

## Gdzie przetwarzane są dane

| Wariant | Gdzie trafia pytanie | Dane osobowe |
|---|---|---|
| lokalny (Ollama) | serwer urzędu | nie opuszczają urzędu |
| demo (API w chmurze) | dostawca API | tylko dane fikcyjne; pytania asystenta formalnego dotyczą procedury, nie osób; do analizy OSP wysyłamy treść stanowiska (zadania, cel, kompetencje), bez imion i nazwisk pracowników |

## Do zrobienia przed wdrożeniem produkcyjnym

- autoryzacja endpointów asystenta (Z04) i powiązanie dziennika zapytań z użytkownikiem;
- pseudonimizacja danych osobowych przed wysłaniem do modelu w funkcjach operujących na danych pracowników (Z34);
- strojenie progów wyszukiwania na zestawie testowym (Z25) i dodanie ustawy o służbie cywilnej do bazy wiedzy;
- limit zapytań we współdzielonym magazynie (np. Redis) przy wielu instancjach.
