import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Nie znaleziono strony – Kompas Kompetencji" };

// Strona 404 po polsku. Trafia tu także adres oceny lub pracownika spoza uprawnień użytkownika –
// celowo wygląda tak samo jak nieistniejący, żeby nie ujawniać, że taki rekord jest w bazie.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <Compass className="size-10 text-primary" aria-hidden />
      <h1 className="text-2xl font-semibold">Nie znaleziono strony</h1>
      <p className="text-muted-foreground">
        Ten adres nie istnieje albo prowadzi do danych, do których nie masz dostępu. Sprawdź adres albo wróć do swojego ekranu startowego.
      </p>
      <Button asChild>
        <Link href="/">Wróć do ekranu startowego</Link>
      </Button>
    </main>
  );
}
