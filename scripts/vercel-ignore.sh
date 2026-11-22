#!/bin/bash
# Ignored Build Step w Vercelu (vercel.json → ignoreCommand). Plan Hobby: 100 wdrożeń dziennie i jeden build naraz.
# Kod wyjścia: 1 = buduj, 0 = pomiń (wdrożenie dostaje status „Canceled”).
# Przy każdej wątpliwości (brak zmiennej, brak poprzedniego commita w płytkim klonie) – budujemy, żeby nie zablokować produkcji.

ref="${VERCEL_GIT_COMMIT_REF:-}"
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
echo "Gałąź: ${ref:-?}, środowisko: ${VERCEL_ENV:-?}, poprzednie wdrożenie: ${prev:-brak}"

# Inne gałęzie niż main nie są wdrażane (git.deploymentEnabled w vercel.json zwykle nie tworzy ich wcale).
if [ -n "$ref" ] && [ "$ref" != "main" ]; then
  echo "Pomijam: wdrażamy tylko gałąź main."
  exit 0
fi

# Zmiany tylko w dokumentacji i testach od ostatniego wdrożenia – aplikacja się nie zmienia, build niepotrzebny.
if [ -n "$prev" ] && git cat-file -e "$prev^{commit}" 2>/dev/null; then
  if git diff --quiet "$prev" HEAD -- . ':(exclude)docs' ':(exclude)README.md' ':(exclude)eval/*.md' ':(exclude)e2e' ':(exclude)tests'; then
    echo "Pomijam: od ostatniego wdrożenia zmieniła się tylko dokumentacja albo testy."
    exit 0
  fi
fi

echo "Buduję."
exit 1
