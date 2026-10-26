import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, type AllowedImageType } from "@/lib/images";

/**
 * Baja una foto desde cualquier enlace (una foto directa o una página con foto, como una tienda).
 * Se cuida de que el enlace no apunte a direcciones internas: solo http/https en los puertos de siempre,
 * se revisa a dónde apunta el nombre antes de pedirlo y también cada redirección.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 1_500_000;
const TIMEOUT_MS = 15_000;

export type RemoteImage = { bytes: Uint8Array; type: AllowedImageType; ext: string };

export class RemoteImageError extends Error {
  /** La página no dejó que el servidor la lea (suele pasar con tiendas grandes). */
  readonly blocked: boolean;
  constructor(message: string, blocked = false) {
    super(message);
    this.blocked = blocked;
  }
}

export const BLOCKED_MESSAGE =
  "Esa página no deja bajar la foto. Probá con el enlace directo de la foto: mantené apretada la foto, elegí «Copiar dirección de la imagen» y pegala acá.";

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return /^(fc|fd|fe[89ab]|ff)/.test(v6);
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RemoteImageError("Ese enlace no es válido.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new RemoteImageError("El enlace tiene que empezar con https://");
  if (url.username || url.password) throw new RemoteImageError("Ese enlace no es válido.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new RemoteImageError("Ese enlace no es válido.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new RemoteImageError("Ese enlace no es válido.");
    return url;
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new RemoteImageError("Ese enlace no es válido.");
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new RemoteImageError("No pudimos abrir ese enlace.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) throw new RemoteImageError("Ese enlace no es válido.");
  return url;
}

/** Pide la dirección siguiendo redirecciones a mano (revisando cada una) y lee hasta `limit` bytes. */
async function fetchLimited(raw: string, limit: number): Promise<{ url: URL; type: string; bytes: Uint8Array; truncated: boolean }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "image/avif,image/webp,image/jpeg,image/png,text/html;q=0.8,*/*;q=0.5", "Accept-Language": "es-AR,es;q=0.9" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new RemoteImageError("No pudimos abrir ese enlace.");
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new RemoteImageError("No pudimos abrir ese enlace.");
      current = new URL(next, url).toString();
      continue;
    }
    if (res.status === 403 || res.status === 401 || res.status === 429) throw new RemoteImageError(BLOCKED_MESSAGE, true);
    if (!res.ok) throw new RemoteImageError("No pudimos abrir ese enlace.");
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > limit * 4) throw new RemoteImageError("El archivo es demasiado grande.");
    const reader = res.body?.getReader();
    if (!reader) throw new RemoteImageError("No pudimos abrir ese enlace.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(Math.min(total, limit));
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c.subarray(0, Math.min(c.byteLength, bytes.byteLength - offset)), offset);
      offset += c.byteLength;
    }
    return { url, type, bytes, truncated };
  }
  throw new RemoteImageError("Ese enlace tiene demasiadas vueltas.");
}

/** Mira los primeros bytes para confirmar que de verdad es una foto del tipo que dice. */
export function sniff(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length > 12 && ascii(4, 8) === "ftyp" && /^(avif|avis)$/.test(ascii(8, 12))) return "image/avif";
  return null;
}

/** Busca en una página la foto principal (og:image y parecidas). */
export function pageImage(html: string, base: URL): string | null {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const pick = (names: string[]) => {
    for (const tag of metas) {
      const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
      const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (key && content && names.includes(key)) return content;
    }
    return null;
  };
  const found = pick(["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ?? /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ?? null;
  if (!found) return null;
  try {
    return new URL(found.replace(/&amp;/g, "&"), base).toString();
  } catch {
    return null;
  }
}

export async function downloadRemoteImage(link: string): Promise<RemoteImage> {
  const raw = link.trim();
  if (raw.length < 8 || raw.length > 2000) throw new RemoteImageError("Pegá el enlace de la foto.");

  const first = await fetchLimited(raw, MAX_IMAGE_BYTES + 1);
  let found = first;
  if (first.type.startsWith("text/html") || first.type === "application/xhtml+xml") {
    const html = new TextDecoder().decode(first.bytes.subarray(0, MAX_HTML_BYTES));
    const imageUrl = pageImage(html, first.url);
    if (!imageUrl) {
      // Mercado Libre (y otras) devuelven una página de «tráfico sospechoso» a los programas.
      if (/suspicious-traffic|captcha|robot/i.test(html)) throw new RemoteImageError(BLOCKED_MESSAGE, true);
      throw new RemoteImageError("En esa página no encontramos una foto. Probá con el enlace directo de la foto: mantené apretada la foto, elegí «Copiar dirección de la imagen» y pegala acá.");
    }
    found = await fetchLimited(imageUrl, MAX_IMAGE_BYTES + 1);
  }
  if (found.truncated || found.bytes.byteLength > MAX_IMAGE_BYTES) throw new RemoteImageError("La foto pesa más de 5 MB.");
  const type = sniff(found.bytes);
  if (!type) throw new RemoteImageError("Ese enlace no es una foto (JPG, PNG, WebP o AVIF).");
  return { bytes: found.bytes, type, ext: ALLOWED_IMAGE_TYPES[type] };
}
