import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";

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
    <html lang="pl">
      <body className={`${notoSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
