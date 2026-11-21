# Wykorzystanie AI w Kompasie Kompetencji

> Dokument rozwijany w trakcie prac (pełna wersja: Z31). Stan: warstwa modelu (Z20), baza wiedzy (Z21), asystent formalny (Z22).

## Zasada nadrzędna

**Przepisy liczy kod, nie model językowy.** Wybór arkusza, punkty, średnie, wynik pozytywny/negatywny i terminy to deterministyczne funkcje z testami (`src/lib/rules/`). AI tylko doradza, wyszukuje i redaguje. Każda propozycja AI jest oznaczona, a decyzję podejmuje człowiek.

## Gdzie jest AI, a gdzie celowo go nie ma

| Element | AI? | Uwagi |
|---|---|---|
| Asystent formalny (pytania o procedurę) | tak | odpowiedź wyłącznie z fragmentów przepisów i poradników, zawsze ze źródłem |
| Punktacja, wynik, terminy, wybór arkusza | **nie** | silnik reguł z testami |
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
| demo (API w chmurze) | dostawca API | tylko dane fikcyjne; pytania asystenta formalnego dotyczą procedury, nie osób |

## Do zrobienia przed wdrożeniem produkcyjnym

- autoryzacja endpointów asystenta (Z04) i powiązanie dziennika zapytań z użytkownikiem;
- pseudonimizacja danych osobowych przed wysłaniem do modelu w funkcjach operujących na danych pracowników (Z34);
- dodanie ustawy o służbie cywilnej do bazy wiedzy i ponowny pomiar `npm run eval`;
- limit zapytań we współdzielonym magazynie (np. Redis) przy wielu instancjach.
