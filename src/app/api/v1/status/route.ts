import { NextResponse } from "next/server";

// Prosty endpoint kontrolny dla wdrożenia – nie wymaga bazy danych.
export function GET() {
  return NextResponse.json({ status: "ok", aplikacja: "Kompas Kompetencji" });
}
