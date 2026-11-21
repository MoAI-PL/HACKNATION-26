// Błąd niekompletnych lub sprzecznych danych wejściowych silnika reguł.
// Komunikat jest po polsku i nadaje się do pokazania użytkownikowi.

export class RulesInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RulesInputError";
  }
}
