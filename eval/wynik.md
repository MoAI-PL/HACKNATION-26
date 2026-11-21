# Wynik zestawu testowego asystenta formalnego

Data: 21.11.2026, 19:51:10 · baza wiedzy: 406 fragmentów · pytania: 25 w zakresie + 5 spoza zakresu (`eval/pytania.json`)

| Miara | Wynik |
|---|---|
| **Trafność odpowiedzi** (właściwe źródło i treść) | **25/25 (100%)** |
| **Odpowiedzi ze źródłem** | **25/25 (100%)** |
| **Poprawne odmowy** (pytania spoza zakresu) | **5/5 (100%)** |
| Ostrzeżenia o przepisie spoza źródeł | 0 |
| Średni czas odpowiedzi | 1.2 s |
| Model | gemini-3.5-flash-lite |
| Wyszukiwanie: właściwy fragment w top 5 | 25/25 (100%) |
| Wyszukiwanie: odmowa bez pytania modelu (spoza zakresu) | 3/5 (60%) |
| Wyszukiwanie: średnia pozycja właściwego fragmentu | 1.2 |

## Błędy do poprawy

| ID | Poziom | Pytanie | Powód |
|---|---|---|---|
| P01 | wyszukiwanie | Ile zarabia dyrektor departamentu w ministerstwie? | wyszukiwarka przepuściła pytanie spoza zakresu (decyzja przechodzi na model) |
| P02 | wyszukiwanie | Ile dni urlopu wypoczynkowego przysługuje pracownikowi? | wyszukiwarka przepuściła pytanie spoza zakresu (decyzja przechodzi na model) |
