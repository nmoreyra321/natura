// Verifica las políticas RLS contra una instancia de Supabase (local o de prueba).
// Uso: node tests/rls-check.mjs  (lee .env.local). Requiere usuarios de prueba:
//   ADMIN_EMAIL/ADMIN_PASSWORD (administradora) y USER_EMAIL/USER_PASSWORD (sin permisos).
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const opts = { auth: { persistSession: false } };
let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? "✓" : "✖"} ${name}`);
  if (!ok) failures++;
};

const anon = createClient(url, key, opts);
const user = createClient(url, key, opts);
const admin = createClient(url, key, opts);
await user.auth.signInWithPassword({ email: process.env.USER_EMAIL, password: process.env.USER_PASSWORD });
await admin.auth.signInWithPassword({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });

const sample = { name: "Prueba RLS", slug: `prueba-rls-${Date.now()}`, magazine_price: 100, sale_price: 90, stock: 1 };

// Registro público deshabilitado
const signup = await anon.auth.signUp({ email: `x${Date.now()}@test.local`, password: "Abcdefgh123" });
check("registro público deshabilitado", Boolean(signup.error));

for (const [who, c] of [["anónimo", anon], ["usuaria sin permisos", user]]) {
  const ins = await c.from("products").insert(sample).select();
  check(`${who}: no puede crear productos`, Boolean(ins.error) || (ins.data ?? []).length === 0);
  const adm = await c.from("admin_users").insert({ user_id: "00000000-0000-0000-0000-000000000000" });
  check(`${who}: no puede asignarse administradora`, Boolean(adm.error));
  const rpc = await c.rpc("is_admin");
  check(`${who}: is_admin() = false`, rpc.data === false);
  const up = await c.storage.from("product-images").upload(`products/${crypto.randomUUID()}/${crypto.randomUUID()}.png`, new Blob(["x"], { type: "image/png" }), { contentType: "image/png" });
  check(`${who}: no puede subir fotos`, Boolean(up.error));
  const cat = await c.from("categories").update({ name: "Hackeada" }).neq("id", "00000000-0000-0000-0000-000000000000").select();
  check(`${who}: no puede editar categorías`, Boolean(cat.error) || (cat.data ?? []).length === 0);
}

// La administradora sí puede, y los borradores no son públicos
const draft = await admin.from("products").insert({ ...sample, status: "draft" }).select().single();
check("administradora: crea productos", !draft.error);
const seenDraft = await anon.from("products").select("id").eq("id", draft.data?.id);
check("anónimo: no ve borradores", (seenDraft.data ?? []).length === 0);
const upd = await user.from("products").update({ sale_price: 1 }).eq("id", draft.data?.id).select();
check("usuaria sin permisos: no puede editar productos", (upd.data ?? []).length === 0);
const del = await anon.from("products").delete().eq("id", draft.data?.id).select();
check("anónimo: no puede borrar productos", (del.data ?? []).length === 0);
const badOffer = await admin.from("products").update({ is_offer: true, sale_price: 100 }).eq("id", draft.data?.id);
check("base de datos: rechaza oferta sin descuento", Boolean(badOffer.error));
const badStock = await admin.from("products").update({ stock: -1 }).eq("id", draft.data?.id);
check("base de datos: rechaza stock negativo", Boolean(badStock.error));
const badPrice = await admin.from("products").update({ sale_price: 0 }).eq("id", draft.data?.id);
check("base de datos: rechaza precio cero", Boolean(badPrice.error));
const gif = await admin.storage.from("product-images").upload(`products/${draft.data?.id}/${crypto.randomUUID()}.gif`, new Blob(["GIF89a"], { type: "image/gif" }), { contentType: "image/gif" });
check("storage: rechaza formatos no permitidos", Boolean(gif.error));
await admin.from("products").delete().eq("id", draft.data?.id);

console.log(failures ? `\n${failures} verificaciones fallaron` : "\nTodas las verificaciones de permisos pasaron");
process.exit(failures ? 1 : 0);
