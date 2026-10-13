import { expect, test } from "@playwright/test";

/**
 * Pedido por WhatsApp con un número de PRUEBA, solo en desarrollo:
 *   NEXT_PUBLIC_WHATSAPP_NUMBER=5491100000000 npx next dev -p 3001
 *   E2E_WHATSAPP=1 E2E_PRODUCT_SLUG=<slug publicado> BASE_URL=http://localhost:3001 npx playwright test whatsapp
 */
test.skip(!process.env.E2E_WHATSAPP, "Solo con E2E_WHATSAPP=1 y un servidor de desarrollo con número de prueba");

test("arma el mensaje del pedido con productos, cantidades, subtotales y total", async ({ page }) => {
  const slug = process.env.E2E_PRODUCT_SLUG!;
  await page.goto(`/productos/${slug}`);
  const inquiry = page.getByRole("link", { name: "Consultar por WhatsApp" });
  await expect(inquiry).toHaveAttribute("href", /^https:\/\/wa\.me\/5491100000000\?text=/);

  await page.getByLabel("Sumar una unidad").click();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.goto("/carrito");

  const order = page.getByRole("link", { name: "Hacer pedido por WhatsApp" });
  await expect(order).toBeVisible();
  const href = (await order.getAttribute("href"))!;
  const url = new URL(href);
  expect(url.origin + url.pathname).toBe("https://wa.me/5491100000000");
  const text = url.searchParams.get("text")!;
  console.log("\n--- Mensaje generado ---\n" + text + "\n------------------------");
  expect(text).toContain("¡Hola Mariel! Quiero hacer este pedido:");
  expect(text).toMatch(/2 x \$ [\d.]+,\d{2} = \$ [\d.]+,\d{2}/);
  expect(text).toMatch(/\*Total: \$ [\d.]+,\d{2}\*/);
  expect(text).toContain("Quedo a la espera de tu confirmación");
  await expect(order).toHaveAttribute("target", "_blank");

  // Hacer clic no vacía el carrito
  const popup = page.waitForEvent("popup").catch(() => null);
  await order.click();
  const p = await popup;
  await p?.close();
  await page.reload();
  await expect(page.getByRole("link", { name: "Hacer pedido por WhatsApp" })).toBeVisible();
  await expect(page.getByLabel(/Carrito: 2 productos/)).toBeVisible();
});
