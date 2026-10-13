import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const USER = { email: process.env.E2E_USER_EMAIL ?? "", password: process.env.E2E_USER_PASSWORD ?? "" };
const NAME = `Crema de prueba ${Date.now()}`;
const img = (f: string) => path.join(__dirname, f);

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/admin/login");
  await page.getByLabel("Correo electrónico").fill(who.email);
  await page.getByLabel("Contraseña").fill(who.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test("captura del login", async ({ page }) => {
  await page.goto("/admin/login");
  await shot(page, "02-login");
});

/** Capturas opcionales para revisar el diseño (SCREENSHOTS_DIR=carpeta). */
async function shot(page: Page, name: string) {
  const dir = process.env.SCREENSHOTS_DIR;
  if (dir) await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe.configure({ mode: "serial" });

test("tienda vacía muestra el mensaje de bienvenida y no inventa productos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Natura te encanta.");
  await expect(page.getByText("Estamos preparando algo lindo para vos.")).toBeVisible();
  await expect(page.getByText("Pronto vas a encontrar tus favoritos Natura a precios especiales.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar productos" })).toHaveCount(0);
  await noHorizontalScroll(page);
  await shot(page, "01-inicio-vacio");
  await page.goto("/productos");
  await expect(page.getByText("Estamos preparando algo lindo para vos.")).toBeVisible();
  // Categoría sin productos no se muestra como catálogo
  const res = await page.goto("/categorias/perfumeria");
  expect(res?.status()).toBe(404);
});

test("el panel exige login y rechaza credenciales o cuentas sin permisos", async ({ page }) => {
  await page.goto("/admin/productos");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await login(page, { email: ADMIN.email, password: "ClaveIncorrecta123" });
  await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
  await login(page, USER);
  await expect(page.getByText("Esta cuenta no tiene permisos de administradora.")).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("la administradora crea, publica, edita y elimina un producto con fotos", async ({ page }) => {
  await login(page, ADMIN);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "¡Hola, Mariel!" })).toBeVisible();
  await expect(page.getByText("Falta configurar el número de WhatsApp.")).toBeVisible();
  await shot(page, "03-panel-inicio");

  // Validaciones del formulario
  await page.getByRole("link", { name: "Nuevo producto" }).first().click();
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByText("El nombre tiene que tener al menos 2 caracteres.")).toBeVisible();

  await page.getByLabel("Nombre").fill(NAME);
  await page.getByLabel("Categoría").selectOption({ label: "Perfumería" });
  await page.getByLabel("Presentación o tamaño").fill("200 ml");
  await page.getByLabel("Descripción").fill("Hidratación profunda con aroma suave.");
  await page.getByLabel("Precio de revista ($)").fill("25.000");
  await page.getByLabel("Precio especial Natu Mariel ($)").fill("25000");
  await page.getByText("Oferta", { exact: true }).click();
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByText("Para marcarlo como oferta, el precio especial tiene que ser menor")).toBeVisible();

  await page.getByLabel("Precio especial Natu Mariel ($)").fill("20.000");
  await expect(page.getByText("(20%)")).toBeVisible();
  await shot(page, "04-panel-nuevo-producto");
  await noHorizontalScroll(page);
  await page.getByLabel("Stock disponible").fill("2");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/admin\/productos\/[0-9a-f-]{36}\?nuevo=1/);
  await expect(page.getByText("¡Producto creado!")).toBeVisible();

  // Fotos: archivo inválido, alta y reemplazo
  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.setInputFiles(img("no-es-imagen.png"));
  await expect(page.getByText(/no-es-imagen\.png/)).toBeVisible();
  await fileInput.setInputFiles(img("foto-rosa.png"));
  await expect(page.getByText("Foto agregada.")).toBeVisible();
  await expect(page.getByAltText(`Foto 1 de ${NAME}`)).toBeVisible();
  const firstSrc = await page.getByAltText(`Foto 1 de ${NAME}`).getAttribute("src");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Reemplazar foto 1" }).click();
  await (await chooser).setFiles(img("foto-verde.png"));
  await expect(page.getByText("Foto reemplazada.")).toBeVisible();
  await expect(page.getByAltText(`Foto 1 de ${NAME}`)).not.toHaveAttribute("src", firstSrc ?? "");
  const imgUrl = await page.getByAltText(`Foto 1 de ${NAME}`).getAttribute("src");
  expect((await page.request.get(imgUrl!)).status()).toBe(200);
  expect((await page.request.get(firstSrc!)).status()).toBeGreaterThanOrEqual(400);
  await shot(page, "05-panel-fotos");

  // Borrador: no visible en la tienda
  await page.goto("/productos");
  await expect(page.getByText(NAME)).toHaveCount(0);

  // Publicar desde el listado
  await page.goto("/admin/productos");
  const row = page.locator("li", { hasText: NAME });
  await row.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("¡Producto publicado!")).toBeVisible();
  await shot(page, "06-panel-listado");
  await noHorizontalScroll(page);

  // Aparece en la tienda pública automáticamente
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Explorar productos" })).toBeVisible();
  await expect(page.getByRole("link", { name: NAME }).first()).toBeVisible();
  await expect(page.getByText("−20%").first()).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, "07-inicio-con-producto");

  // Ficha: precios y stock
  await page.getByRole("link", { name: NAME }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
  await expect(page.getByText("$ 20.000,00").first()).toBeVisible();
  await expect(page.getByText("$ 25.000,00").first()).toBeVisible();
  await expect(page.getByText(/Ahorrás \$ 5\.000,00/)).toBeVisible();
  await expect(page.getByText("Últimas 2 unidades")).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(ld ?? "{}").offers.price).toBe("20000.00");
  await noHorizontalScroll(page);
  await shot(page, "08-ficha-producto");

  // Cantidad: no supera el stock
  await page.getByLabel("Sumar una unidad").click();
  await expect(page.getByLabel("Sumar una unidad")).toBeDisabled();
  await page.getByLabel("Cantidad", { exact: true }).fill("9");
  await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByLabel("Carrito: 2 productos")).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeDisabled();

  // Carrito persistente
  await page.goto("/carrito");
  await page.reload();
  await expect(page.getByRole("link", { name: NAME })).toBeVisible();
  await expect(page.getByText("$ 40.000,00").first()).toBeVisible();
  await expect(page.getByText("$ 10.000,00")).toBeVisible(); // ahorro
  // WhatsApp sin configurar: deshabilitado, sin enlaces rotos
  await expect(page.getByRole("button", { name: "Hacer pedido por WhatsApp" })).toBeDisabled();
  await expect(page.getByText("Estamos terminando de configurar los pedidos por WhatsApp.")).toBeVisible();
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await noHorizontalScroll(page);
  await shot(page, "09-carrito");

  // Stock 0 desde el panel → la tienda lo refleja y el carrito se ajusta
  await page.goto("/admin/productos");
  const stockInput = page.locator("li", { hasText: NAME }).getByLabel("Stock");
  await stockInput.fill("0");
  await stockInput.press("Enter");
  await expect(page.getByText("Stock actualizado.")).toBeVisible();
  await page.goto("/productos");
  await page.getByRole("link", { name: NAME }).first().click();
  await expect(page.getByText("Sin stock").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar al carrito" })).toHaveCount(0);
  await page.goto("/carrito");
  await expect(page.getByText(/se quedó sin stock/)).toBeVisible();
  await expect(page.getByText("Tu carrito está vacío")).toBeVisible();

  // Editar precio: el cambio se ve en la tienda
  await page.goto("/admin/productos");
  await page.locator("li", { hasText: NAME }).getByRole("link", { name: "Editar" }).click();
  await page.getByLabel("Precio especial Natu Mariel ($)").fill("18000");
  await page.getByLabel("Stock disponible").fill("5");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  const slug = await page.getByLabel("URL del producto").inputValue();
  await page.goto(`/productos/${slug}`);
  await expect(page.getByText("$ 18.000,00").first()).toBeVisible();
  await expect(page.getByText("−28%").first()).toBeVisible();

  // Responsive: sin scroll horizontal en anchos clave
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of ["/", "/productos", `/productos/${slug}`, "/carrito", "/contacto", "/admin", "/admin/productos", "/admin/productos/nuevo", "/admin/categorias"]) {
      await page.goto(url);
      await noHorizontalScroll(page);
    }
    if (width === 1440) {
      await page.goto("/");
      await shot(page, "10-escritorio-inicio");
      await page.goto(`/productos/${slug}`);
      await shot(page, "11-escritorio-ficha");
      await page.goto("/admin/productos");
      await shot(page, "12-escritorio-panel");
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // Despublicar y eliminar con confirmación
  await page.goto("/admin/productos");
  await page.locator("li", { hasText: NAME }).getByRole("button", { name: `Eliminar ${NAME}` }).click();
  await expect(page.getByRole("heading", { name: "¿Eliminar este producto?" })).toBeVisible();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText("Producto eliminado.")).toBeVisible();
  expect((await page.request.get(imgUrl!)).status()).toBeGreaterThanOrEqual(400);
  const gone = await page.goto(`/productos/${slug}`);
  expect(gone?.status()).toBe(404);
  await page.goto("/");
  await expect(page.getByText("Estamos preparando algo lindo para vos.")).toBeVisible();
});
