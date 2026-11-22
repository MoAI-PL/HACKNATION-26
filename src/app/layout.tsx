import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { DISPLAY_INIT_SCRIPT } from "@/lib/ui/dostepnosc";

// Open Sans – ta sama czcionka co portal gov.pl (strona Ministerstwa Cyfryzacji); latin-ext – polskie znaki (licencja OFL).
const openSans = Open_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
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
      <body className={`${openSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
