# Licencje zależności

Zasada: wyłącznie licencje permisywne (MIT, Apache-2.0, BSD, ISC; OFL dla czcionek). **Zakaz GPL i AGPL.**
Każdą nową zależność dopisz tutaj w tym samym commicie, w którym ją dodajesz.

Sprawdzenie całego drzewa zależności produkcyjnych:

```
npx license-checker-rseidelsohn --production --summary
```

## Zależności bezpośrednie

| Pakiet | Wersja | Licencja | Do czego |
|---|---|---|---|
| next | 15.5 | MIT | framework aplikacji (interfejs + API) |
| react, react-dom | 19.1 | MIT | interfejs |
| tailwindcss, @tailwindcss/postcss | 4 | MIT | style |
| shadcn | 4 | MIT | komponenty interfejsu (style bazowe) |
| radix-ui | 1.8 | MIT | dostępne prymitywy komponentów |
| class-variance-authority | 0.7 | Apache-2.0 | warianty komponentów |
| cn | 0.5 | MIT | łączenie klas Tailwind |
| tw-animate-css | 1.4 | MIT | animacje |
| lucide-react | 1.77 | ISC | ikony |
| zod | 4 | MIT | walidacja danych |
| next-auth (Auth.js) | 5 | ISC | logowanie, sesje |
| bcryptjs | 3 | BSD-3-Clause | hashowanie haseł |
| @prisma/client, prisma | 6.19 | Apache-2.0 | dostęp do bazy danych, migracje |
| minisearch | 7.2 | MIT | wyszukiwanie BM25 w bazie wiedzy asystenta |
| pdfjs-dist | 6.5 | Apache-2.0 | odczyt tekstu z PDF przy budowie bazy wiedzy (tylko skrypt) |
| fflate | 0.8 | MIT | rozpakowanie plików .xlsx (ZIP) przy imporcie modelu kompetencji |
| fast-xml-parser | 5 | MIT | odczyt XML z plików .xlsx przy imporcie modelu kompetencji (zależności: strnum, MIT) |
| typescript | 5 | Apache-2.0 | język |
| vitest | 3 | MIT | testy |
| vite-tsconfig-paths | 6 | MIT | aliasy `@/` w testach |
| tsx | 4 | MIT | uruchamianie skryptów TS |
| eslint, eslint-config-next, @eslint/eslintrc | 9 / 15.5 / 3 | MIT | lint |
| Noto Sans (przez `next/font`) | — | OFL-1.1 | czcionka z polskimi znakami |

## Uwagi do zależności przechodnich

| Pakiet | Licencja | Ocena |
|---|---|---|
| `caniuse-lite` | CC-BY-4.0 | dane o przeglądarkach używane tylko przy budowaniu; licencja uznaniowa, wystarcza przypisanie autorstwa |
| `@img/sharp-*` (opcjonalna zależność Next.js) | Apache-2.0 + LGPL-3.0 (biblioteka libvips, linkowana dynamicznie) | używana wyłącznie do optymalizacji obrazów `next/image`; nie jest GPL/AGPL. Jeśli MC wymaga, można ją wyłączyć (`images.unoptimized`) i usunąć |
