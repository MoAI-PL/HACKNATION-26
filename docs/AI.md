# Wykorzystanie AI w Kompasie Kompetencji

AI w Kompasie Kompetencji **wspiera** przełożonego – wyszukuje przepisy, redaguje odpowiedzi i proponuje kryteria – ale **nigdy nie ustala oceny**. Wszystko, co wynika z przepisów (arkusz, punkty, wynik, terminy, sugerowany poziom), liczy kod.

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
- Konfiguracja wyłącznie w `.env` (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_TIMEOUT_MS`, `LLM_REASONING_EFFORT`) – **zmiana modelu nie wymaga zmiany kodu**. Puste wartości oznaczają brak ustawienia.
- `LLM_REASONING_EFFORT` (opcjonalnie, np. `low`) przekazuje parametr `reasoning_effort` – modele „myślące” (np. Gemini 2.5+) odpowiadają wtedy znacznie szybciej. Wysyłany tylko, gdy ustawiony, więc nie przeszkadza dostawcom, którzy go nie znają.
- Limit czasu odpowiedzi (domyślnie 30 s), czytelne komunikaty po polsku przy złym kluczu, limicie zapytań, braku połączenia i niepoprawnej odpowiedzi.
- **Demo:** Google AI Studio (Gemini), `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, klucz jako sekret w ustawieniach hostingu.
- Wariant docelowy w urzędzie: model lokalny przez Ollamę (np. Bielik, PLLuM) – dane nie opuszczają infrastruktury urzędu.
- Wariant demo: darmowy plan dostawcy zgodnego z API OpenAI; na demo wyłącznie dane fikcyjne.
- Brak modelu albo jego błąd (limit, przekroczony czas, zły klucz) **nie blokuje aplikacji**: asystent przechodzi w tryb bez AI i pokazuje pasujące fragmenty przepisów.

## Asystent formalny – jak ogranicza halucynacje

1. **Wyszukanie przed odpowiedzią:** BM25 na 406 fragmentach (rozporządzenia według § i ustępów, poradniki KPRM według rozdziałów, model kompetencji – po jednym fragmencie na wskaźnik, FAQ). Przy słabym dopasowaniu asystent odmawia **bez pytania modelu**: „Nie znalazłem tej informacji w dostępnych źródłach. Skontaktuj się z komórką kadr.”
2. **Kontekst = tylko fragmenty.** Prompt systemowy wymaga odpowiedzi wyłącznie z fragmentów, zabrania wymyślania numerów przepisów i nakazuje zgłosić „brak w źródłach”.
3. **Odpowiedź strukturalna (JSON)** z numerami użytych źródeł, walidowana schematem; jedna ponowna próba przy niezgodności.
4. **Odpowiedź bez poprawnego źródła = odmowa.** Nie pokazujemy odpowiedzi, której nie da się przypisać do fragmentu.
5. **Kontrola cytowań:** jeśli odpowiedź wymienia artykuł lub paragraf, którego nie ma w podanych fragmentach, użytkownik dostaje ostrzeżenie.
6. **Ochrona przed prompt injection:** treść fragmentów i pytania trafia do modelu jako dane w znacznikach; znaki `<` `>` są neutralizowane, więc pytanie nie może „zamknąć” znacznika ani udawać źródła. Prompt nakazuje ignorować polecenia zawarte w danych.
7. **Dziennik zapytań** (`AssistantQuery`): pytanie, użyte źródła, odpowiedź, odmowa, krok ścieżki, model, czas.
8. **Limit zapytań:** 20 pytań na minutę na użytkownika (chroni darmowy limit dostawcy); asystent jest dostępny tylko po zalogowaniu (przełożony, HR, kierujący).

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

## Zestaw testowy asystenta (Z25)

- Pytania: `eval/pytania.json` – 25 pytań w zakresie (sformułowanych inaczej niż w FAQ) z odpowiedzią wzorcową, akceptowanymi źródłami i słowami kluczowymi oraz 5 pytań spoza zakresu (w tym próba prompt injection).
- Uruchomienie: `npm run eval` (z modelem z `.env`) albo `npm run eval -- --bez-ai` (tylko wyszukiwanie, bez modelu). Wynik: `eval/wynik.md` (tabela na slajd) i `eval/wynik.json` (szczegóły każdej odpowiedzi).
- Miary:
  - **trafność** – odpowiedź w trybie AI, z co najmniej jednym oczekiwanym źródłem i z wymaganą treścią (np. „7 dni”);
  - **odpowiedzi ze źródłem** – odsetek pytań w zakresie, na które asystent odpowiedział ze wskazaniem fragmentu;
  - **poprawne odmowy** – odsetek pytań spoza zakresu zakończonych odmową;
  - osobno poziom wyszukiwania: czy właściwy fragment jest w top 5 i czy pytanie spoza zakresu odpada bez pytania modelu.
- Test regresji (`tests/ai/eval.test.ts`) pilnuje progu wyszukiwania: ≥ 90% pytań z właściwym fragmentem w top 5, ≥ 3/5 odmów bez modelu, prompt injection zawsze odrzucony.

**Wynik wyszukiwania (21.11, bez modelu):** właściwy fragment w top 5 – **25/25**; odmowa bez pytania modelu – **3/5**. Dwa pytania spoza zakresu (wynagrodzenie, urlop) mają słowa wspólne z poradnikami („dyrektor”, „pracownik”, „dni”), więc odmowę daje dopiero model na podstawie zasady „brak w źródłach”.

**Strojenie (Z25):** zestaw wykazał, że „ocena / oceny / ocenę” miały różne rdzenie (obcinanie do 6 znaków nie łączyło krótkich słów), przez co pytanie „Kiedy najwcześniej można sporządzić pierwszą ocenę?” kończyło się odmową. Krótkie słowa tracą teraz ostatnią literę (`ocen`). Wynik wyszukiwania: 24/25 → 25/25, bez pogorszenia odmów.

**Wynik z modelem (21.11, `gemini-3.5-flash-lite`, darmowy plan Google AI Studio):**

| Miara | Wynik |
|---|---|
| Trafność odpowiedzi (właściwe źródło i treść) | **25/25 (100%)** |
| Odpowiedzi ze źródłem | **25/25 (100%)** |
| Poprawne odmowy (pytania spoza zakresu, w tym prompt injection) | **5/5 (100%)** |
| Ostrzeżenia o przepisie spoza źródeł | 0 |
| Średni czas odpowiedzi | 1,2 s |

Pełny raport: `eval/wynik.md`, szczegóły każdej odpowiedzi: `eval/wynik.json`.

Uwagi do pomiaru:
- Pierwszy pełny przebieg dał 24/25: w Q06 odpowiedź była poprawna („w 24-miesięcznym terminie”), ale zestaw nie rozpoznawał zapisu z łącznikiem i nie uznawał fragmentów poradnika, w których termin występuje w tej formie. Poprawiono zestaw (porównanie słów ignoruje łączniki, lista źródeł Q06 obejmuje wszystkie fragmenty z terminem 24 miesięcy), a nie asystenta.
- Dwa pytania spoza zakresu (wynagrodzenie, urlop) przechodzą przez wyszukiwanie, ale model poprawnie odpowiada „brak w źródłach” – działa druga linia obrony z promptu systemowego.
- Model wybrany na demo: `gemini-3.5-flash-lite`. Większy `gemini-3.5-flash` na darmowym planie często zwracał 503 i 429, przekraczał 30 s i urywał odpowiedź JSON (tokeny rozumowania wliczają się do limitu `max_tokens`). Wersja lite odpowiada w ok. 1 s.
- `npm run eval` ponawia zapytanie przy chwilowej niedostępności modelu (503/429/przekroczony czas, do 3 razy) i nie zapisuje wyniku, jeśli model nie odpowiedział na żadne pytanie.

## Gdzie przetwarzane są dane

| Wariant | Gdzie trafia pytanie | Dane osobowe |
|---|---|---|
| lokalny (Ollama) | serwer urzędu | nie opuszczają urzędu |
| demo (API w chmurze) | dostawca API | tylko dane fikcyjne; pytania asystenta formalnego dotyczą procedury, nie osób; do analizy OSP wysyłamy treść stanowiska (zadania, cel, kompetencje), bez imion i nazwisk pracowników |

## Do zrobienia przed wdrożeniem produkcyjnym

- **model lokalny** w infrastrukturze urzędu (Ollama z polskim modelem, np. Bielik / PLLuM) zamiast API w chmurze – zmiana wyłącznie w `.env`, potem ponowny pomiar `npm run eval`;
- pseudonimizacja danych osobowych przed wysłaniem do modelu w funkcjach, które w przyszłości będą operować na danych pracowników (notatki, informacja zwrotna);
- dodanie ustawy o służbie cywilnej (tekst jednolity z ISAP) do bazy wiedzy i ponowny pomiar;
- uzupełnienie bazy wiedzy o zestaw pytań i odpowiedzi MC i wewnętrzne procedury urzędu;
- limit zapytań we współdzielonym magazynie (np. Redis) przy wielu instancjach;
- przegląd promptów i progów wyszukiwania przez komórkę kadr na pytaniach z praktyki urzędu.

Już zrobione: autoryzacja endpointów AI (przełożony, HR, kierujący; oceniany – 403), dziennik zapytań powiązany z użytkownikiem, limit zapytań, działanie bez modelu.
