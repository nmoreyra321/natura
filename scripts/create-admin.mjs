#!/usr/bin/env node
/**
 * Crea (o promueve) la cuenta administradora de Natu Mariel.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run admin:create -- mariel@correo.com
 *
 * - Pide la contraseña por consola (no se muestra ni se guarda en el historial).
 * - Usa la clave secreta de Supabase, que solo debe existir en tu computadora.
 * - Si el usuario ya existe, solo lo agrega como administradora.
 */
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";

// Carga .env.local si existe (sin dependencias extra).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] || "").trim().toLowerCase();

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!url || !secret) fail("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SECRET_KEY.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Indicá un correo válido: npm run admin:create -- correo@ejemplo.com");

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else rl.output.write("*".repeat(s.length));
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Contraseña (mín. 10, con mayúscula, minúscula y número): "));
if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
  fail("La contraseña debe tener al menos 10 caracteres, con mayúsculas, minúsculas y números.");
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError) {
  if (!/already|registered|exists/i.test(createError.message)) fail(`No se pudo crear el usuario: ${createError.message}`);
  // Ya existe: buscarlo para promoverlo.
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`No se pudo buscar el usuario: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) fail("El usuario existe pero no se pudo encontrar.");
  console.log("ℹ El usuario ya existía: no se cambió su contraseña.");
} else {
  userId = created.user.id;
  console.log("✓ Usuario creado.");
}

const { error: adminError } = await supabase.from("admin_users").upsert({ user_id: userId });
if (adminError) fail(`No se pudo asignar el rol de administradora: ${adminError.message}`);

console.log(`✓ ${email} ya es administradora. Ingresá en /admin/login.\n`);
