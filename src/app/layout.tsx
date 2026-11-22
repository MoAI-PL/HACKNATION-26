import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import { DISPLAY_INIT_SCRIPT } from "@/lib/ui/dostepnosc";

// Noto Sans z zestawem latin-ext – poprawne polskie znaki (licencja OFL).
const notoSans = Noto_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Kompas Kompetencji",
  description:
    "Ocena oparta na zachowaniach, nie na wrażeniach. Wsparcie przełożonego w pierwszej ocenie i ocenie okresowej w służbie cywilnej.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: klasy ustawień wyświetlania nakłada skrypt przed hydratacją (src/lib/ui/dostepnosc.ts).
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_INIT_SCRIPT }} />
      </head>
      <body className={`${notoSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
