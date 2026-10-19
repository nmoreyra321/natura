import { describe, expect, it } from "vitest";

import { answerFor, routeText, searchTerm, type HelperInfo } from "@/lib/helper-answers";

const info: HelperInfo = { alias: "Natu.mariel", mpSurcharge: 9.2, shippingMin: "$ 35.000", clubMin: "$ 30.000", giftEvery: 5, deliveryText: "Glew y Lanús" };

describe("ayudante", () => {
  it("reconoce temas conocidos", () => {
    expect(routeText("¿Cómo pago?")).toBe("pagos");
    expect(routeText("hacen envíos a domicilio")).toBe("envios");
    expect(routeText("dónde está mi pedido")).toBe("pedido");
    expect(routeText("quiero saber del club")).toBe("club");
  });
  it("deja pasar los productos", () => {
    expect(routeText("busco una crema para manos")).toBeNull();
    expect(searchTerm("busco una crema para manos")).toBe("crema manos");
  });
  it("arma la respuesta de pagos con los datos reales", () => {
    const t = answerFor("pagos", info).text;
    expect(t).toContain("Natu.mariel");
    expect(t).toContain("9,2 %");
    expect(t).toMatch(/ o con Mercado Pago/);
    expect(answerFor("pagos", { ...info, alias: null, mpSurcharge: 0 }).text).toBe("Podés pagar en efectivo al recibir.");
  });
});
