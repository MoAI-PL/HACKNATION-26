# Tablica zadań – Kompas Kompetencji

Biorąc zadanie: wpisz swoje imię, ustaw status „w toku”, podaj gałąź i **od razu wypchnij zmianę**.
Statusy: `wolne` / `w toku` / `do przeglądu` / `gotowe`. ★ = ścieżka krytyczna demo.
Kolejność: najpierw ★, potem pozostałe P0, potem P1 (w kolejności z tabeli), P2 tylko na końcu.

## A. Fundament

| ID | Zadanie | Zależy od | Status | Kto | Gałąź |
|---|---|---|---|---|---|
| ★Z01 | Porządek w repozytorium, `materialy/`, tablica zadań | — | gotowe | suzanne0401 | `z01-porzadek-repo` |
| ★Z02 | Szkielet aplikacji (Next.js 15, TS, Tailwind, shadcn/ui, Prisma, docker compose, Vitest) | Z01 | gotowe | suzanne0401 | `z02-szkielet` |
| ★Z03 | Kontrakt domeny (`types.ts`, `slownik.ts`, `schema.prisma`, `przepisy.json`) | Z02 | gotowe | Kamson2077 | `z03-kontrakt-domeny` |
| ★Z04 | Logowanie i role, konta demo na ekranie logowania | Z03 | gotowe | suzanne0401 | `z04-logowanie` |

## B. Dane i import

| ID | Zadanie | Zależy od | Status | Kto | Gałąź |
|---|---|---|---|---|---|
| ★Z05 | Import modelu kompetencji (xlsx → JSON) | Z02 | gotowe | Nadia | `z05-import-modelu` |
| ★Z06 | Import OSP (docx) i automatyczny wybór arkusza B/C | Z03 | gotowe | Nadia | `z06-import-osp` |
| ★Z26 | Dane demo (seed) wokół persony przełożonej | Z03 | gotowe | suzanne0401 | `z26-dane-demo` |

## C. Silnik reguł

| ID | Zadanie | Zależy od | Status | Kto | Gałąź |
|---|---|---|---|---|---|
| ★Z07 | Silnik punktacji (§11, §10), walidacja kryteriów dodatkowych | Z03 | gotowe | geoglof | `z07-silnik-punktacji` |
| ★Z08 | Silnik terminów (KC 112/115, święta, nieobecności) | Z03 | gotowe | geoglof | `z08-silnik-terminow` |
| ★Z09 | Sugerowany poziom kompetencji i dane do „Dlaczego ten poziom?” | Z05, Z07 | gotowe | Nadia | `z09-sugerowany-poziom` |

## D. Interfejs i ścieżki

| ID | Zadanie | Zależy od | Status | Kto | Gałąź |
|---|---|---|---|---|---|
| ★Z10 | Układ i system wizualny, komponenty bazowe, `<PropozycjaAI>` | Z02 | gotowe | Kamson2077 | `z10-uklad-ui` |
| ★Z11 | Pulpit przełożonego z kartą „Do zrobienia” | Z04, Z08, Z10 | w toku | Kamson2077 | |
| ★Z12 | Kreator oceny okresowej, część 1 (OSP, arkusz, kryteria, rozmowa rozpoczynająca) | Z06, Z07, Z08, Z10 | gotowe | geoglof | `z12-kreator-okresowej` |
| ★Z13 | Dziennik obserwacji (SDR) | Z03, Z10 | gotowe | Nadia | `z13-dziennik-obserwacji` |
| ★Z41 | Szybka notatka w 10 sekund | Z13, Z20 | wolne | | |
| ★Z14 | Zakończenie oceny: karty zachowań, sugestia, decyzja przełożonego | Z09, Z13 | w toku | geoglof | `z14-zakonczenie-oceny` |
| ★Z15 | Podsumowanie i wynik, uzasadnienie, IPRZ | Z07, Z14 | wolne | | |
| ★Z16 | PDF arkuszy B i C | Z07, Z15 | wolne | | |
| Z17 | Ścieżka pierwszej oceny | Z07, Z08, Z14, Z16 | wolne | | |
| Z18 | Panel HR, część 1 (oceny, terminy, przypomnienia) | Z04, Z08, Z10 | wolne | | |
| Z19 | Panel HR, część 2 (edycja modelu i przepisów) | Z05, Z18 | wolne | | |

## E. Sztuczna inteligencja

| ID | Zadanie | Zależy od | Status | Kto | Gałąź |
|---|---|---|---|---|---|
| ★Z20 | Warstwa LLM (`LLMProvider`, konfiguracja w `.env`) | Z02 | gotowe | suzanne0401 | `z20-z22-asystent` |
| ★Z21 | Baza wiedzy (przepisy, poradniki, ustawa z ISAP, BM25) | Z02 | gotowe | suzanne0401 | `z21-baza-wiedzy` |
| ★Z22 | Asystent formalny ze źródłami i odmową | Z20, Z21 | gotowe | suzanne0401 | `z20-z22-asystent` |
| ★Z23 | Analiza OSP: propozycja kryteriów dodatkowych z cytatem | Z06, Z20 | gotowe | Nadia | `z23-analiza-osp` |
| Z24 | Asystent rozmowy | Z20, Z14 | wolne | | |
| Z25 | Zestaw testowy asystenta (`npm run eval`) | Z22 | wolne | | |

## F. Jakość, wdrożenie, zgłoszenie

| ID | Zadanie | Zależy od | Status | Kto | Gałąź |
|---|---|---|---|---|---|
| ★Z27 | Pytania do mentorów (`docs/ZALOZENIA.md`) | — | wolne | | |
| ★Z28 | Szkic w HackTribe – **wysłać przed 19:30** | Z01 | gotowe | geoglof | — |
| ★Z29 | Publiczne demo | Z04, Z26 | gotowe | suzanne0401 | `z29-publiczne-demo` |
| ★Z44 | Reset danych demo i działanie bez AI | Z20, Z26 | wolne | | |
| Z30 | Testy ręczne, Playwright, dostępność, pomiar czasu oceny | Z15, Z16 | wolne | | |
| Z31 | Dokumentacja (`README`, `docs/`) | całość | wolne | | |
| Z32 | Prezentacja, film, pitch | Z25, Z30 | wolne | | |
| ★Z33 | Zgłoszenie finalne w HackTribe (ok. 08:00) | Z29, Z31, Z32 | wolne | | |

## G. P1 (w tej kolejności)

| ID | Zadanie | Zależy od | Status | Kto | Gałąź |
|---|---|---|---|---|---|
| Z40 | Asystent języka (opis zachowania zamiast opisu osoby) | Z15, Z20 | wolne | | |
| Z36 | Lustro oceniającego | Z09, Z13, Z18 | wolne | | |
| Z42 | Przepisy w kontekście („ⓘ Dlaczego?”) | Z10, Z21 | wolne | | |
| Z43 | Tryb rozmowy | Z24, Z15 | wolne | | |
| Z34 | Pseudonimizacja przed LLM | Z20 | wolne | | |
| Z35 | Dziennik audytu z eksportem CSV | Z14 | wolne | | |
| Z37 | Oś czasu procesu pracownika | Z08 | wolne | | |
| Z38 | REST API `/api/v1` (eksport JSON) | Z15 | wolne | | |

## H. P2

| ID | Zadanie | Status | Kto | Gałąź |
|---|---|---|---|---|
| Z39 | Tryb „5 minut przed rozmową” | wolne | | |
| Z45 | Przypomnienia o regularnych notatkach | wolne | | |
