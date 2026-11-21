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

## Gdzie przetwarzane są dane

| Wariant | Gdzie trafia pytanie | Dane osobowe |
|---|---|---|
| lokalny (Ollama) | serwer urzędu | nie opuszczają urzędu |
| demo (API w chmurze) | dostawca API | tylko dane fikcyjne; pytania asystenta formalnego dotyczą procedury, nie osób |

## Do zrobienia przed wdrożeniem produkcyjnym

- autoryzacja endpointów asystenta (Z04) i powiązanie dziennika zapytań z użytkownikiem;
- pseudonimizacja danych osobowych przed wysłaniem do modelu w funkcjach operujących na danych pracowników (Z34);
- strojenie progów wyszukiwania na zestawie testowym (Z25) i dodanie ustawy o służbie cywilnej do bazy wiedzy;
- limit zapytań we współdzielonym magazynie (np. Redis) przy wielu instancjach.
