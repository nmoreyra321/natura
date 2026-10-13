import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de punta a punta. Requieren:
 * - la app corriendo en BASE_URL (por defecto http://localhost:3000)
 * - una base Supabase de prueba (local) con una administradora y una usuaria sin permisos
 *   (variables E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_USER_EMAIL, E2E_USER_PASSWORD).
 * Nunca correr contra la base de producción: crean y borran productos.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    locale: "es-AR",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
