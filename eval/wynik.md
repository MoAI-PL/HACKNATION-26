# Wynik zestawu testowego asystenta formalnego

Data: 21.11.2026, 18:31:32 · baza wiedzy: 406 fragmentów · pytania: 25 w zakresie + 5 spoza zakresu (`eval/pytania.json`)

| Miara | Wynik |
|---|---|
| Wyszukiwanie: właściwy fragment w top 5 | 25/25 (100%) |
| Wyszukiwanie: odmowa bez pytania modelu (spoza zakresu) | 3/5 (60%) |
| Wyszukiwanie: średnia pozycja właściwego fragmentu | 1.2 |

Zmierzono tylko poziom wyszukiwania (bez modelu). Pełny pomiar: model w `.env` (`LLM_BASE_URL`, `LLM_MODEL`) i `npm run eval`.

## Błędy do poprawy

| ID | Poziom | Pytanie | Powód |
|---|---|---|---|
| P01 | wyszukiwanie | Ile zarabia dyrektor departamentu w ministerstwie? | wyszukiwarka przepuściła pytanie spoza zakresu (decyzja przechodzi na model) |
| P02 | wyszukiwanie | Ile dni urlopu wypoczynkowego przysługuje pracownikowi? | wyszukiwarka przepuściła pytanie spoza zakresu (decyzja przechodzi na model) |
