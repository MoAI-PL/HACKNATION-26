// Wspólne, bezpieczne otwieranie plików Office Open XML (.xlsx, .docx): ZIP + części XML.
// Zabezpieczenia dla plików wgrywanych przez użytkownika: limit rozmiaru po rozpakowaniu,
// odrzucenie XML z deklaracją DOCTYPE (encje XML), rozpakowujemy tylko części .xml i .rels.

import { unzipSync } from "fflate";

export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

export class OoxmlReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OoxmlReadError";
  }
}

export interface OoxmlPackage {
  /** Tekst części XML (np. "word/document.xml") albo undefined, gdy jej nie ma. */
  part(path: string): string | undefined;
}

/** Rozpakowuje pakiet OOXML. `kind` trafia do komunikatu błędu, np. "skoroszytem .xlsx". */
export function openOoxml(data: Uint8Array, kind: string): OoxmlPackage {
  let files: Record<string, Uint8Array>;
  let total = 0;
  try {
    files = unzipSync(data, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_UNCOMPRESSED_BYTES) throw new OoxmlReadError("Plik po rozpakowaniu przekracza 50 MB.");
        return f.name.endsWith(".xml") || f.name.endsWith(".rels");
      },
    });
  } catch (e) {
    if (e instanceof OoxmlReadError) throw e;
    throw new OoxmlReadError(`Plik nie jest ${kind} (nie da się go rozpakować jako archiwum ZIP).`);
  }

  const decoder = new TextDecoder("utf-8");
  return {
    part(path) {
      const bytes = files[path];
      if (!bytes) return undefined;
      const text = decoder.decode(bytes);
      if (/<!DOCTYPE/i.test(text)) {
        throw new OoxmlReadError(`Część „${path}” zawiera deklarację DOCTYPE – takie pliki odrzucamy ze względów bezpieczeństwa.`);
      }
      return text;
    },
  };
}
