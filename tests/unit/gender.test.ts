import { describe, expect, it } from "vitest";

import { guessGender } from "@/lib/gender";

describe("guessGender", () => {
  it("lee el nombre del producto", () => {
    expect(guessGender("Desodorante Kaiak Masculino 100 ml")).toBe("masculino");
    expect(guessGender("Eau de Toilette Femenino Luna Girl 25ml")).toBe("femenino");
    expect(guessGender("Hidratante Corporal Homem 300 ml")).toBe("masculino");
    expect(guessGender("Crema para Manos Ekos Tukumã")).toBeNull();
  });
});
