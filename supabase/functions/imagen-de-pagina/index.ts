// Busca la foto principal (og:image) de una página web.
// Se usa cuando la página no deja que Vercel la lea: desde Supabase a veces sí se puede.
// Solo la pueden usar administradoras con sesión iniciada. Se cuida de no abrir direcciones internas.
import { createClient } from "npm:@supabase/supabase-js@2";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9",
};
const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 1_500_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

function isPrivateIp(ip: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return /^(fc|fd|fe[89ab]|ff)/.test(v6);
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  if (url.username || url.password) throw new Error("auth");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new Error("private");
    return url;
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("private");
  const found: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      found.push(...(await Deno.resolveDns(host, type)));
    } catch {
      // Sin registro de ese tipo.
    }
  }
  if (found.length === 0 || found.some(isPrivateIp)) throw new Error("private");
  return url;
}

function pageImage(html: string, base: URL): string | null {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const pick = (names: string[]) => {
    for (const tag of metas) {
      const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
      const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (key && content && names.includes(key)) return content;
    }
    return null;
  };
  const found =
    pick(["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ??
    /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ??
    null;
  if (!found) return null;
  try {
    return new URL(found.replace(/&amp;/g, "&"), base).toString();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  let current = String(body.url ?? "").trim().slice(0, 2000);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = await assertPublicUrl(current);
      const res = await fetch(url, { headers: HEADERS, redirect: "manual", signal: AbortSignal.timeout(15_000) });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        if (!next) return json({ status: "error" });
        current = new URL(next, url).toString();
        continue;
      }
      if (!res.ok) return json({ status: "blocked" });
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (type.startsWith("image/")) return json({ status: "direct", image: url.toString() });
      if (!type.startsWith("text/html") && type !== "application/xhtml+xml") return json({ status: "error" });
      const reader = res.body?.getReader();
      if (!reader) return json({ status: "error" });
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
        if (total > MAX_HTML_BYTES) {
          await reader.cancel();
          break;
        }
      }
      const all = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        all.set(c, offset);
        offset += c.byteLength;
      }
      const image = pageImage(new TextDecoder().decode(all), url);
      return json(image ? { status: "ok", image } : { status: "no_image" });
    }
  } catch {
    return json({ status: "error" });
  }
  return json({ status: "error" });
});
