"use client";

import { MessageCircleQuestion, Send, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { SearchSuggestion } from "@/lib/catalog";
import { formatARS } from "@/lib/format";
import { HELPER_TOPICS, answerFor, routeText, searchTerm, type HelperInfo, type HelperLink, type HelperTopicId } from "@/lib/helper-answers";
import { productImageUrl } from "@/lib/images";
import { toCents } from "@/lib/pricing";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { ProductImageFallback } from "./product-card";

type Msg =
  | { from: "me"; text: string }
  | { from: "bot"; text: string; links?: HelperLink[]; products?: SearchSuggestion[]; chips?: boolean };

const HELLO: Msg = { from: "bot", text: "¡Hola! Soy el ayudante de Natu Mariel 🌷 ¿Qué necesitás?", chips: true };

/** Botón «¿Te ayudo?» con un ayudante que responde preguntas comunes y busca productos. Sin inteligencia artificial. */
export function Helper({ info, whatsappNumber }: { info: HelperInfo; whatsappNumber: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([HELLO]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/carrito" || pathname.startsWith("/pedido/")) return null;

  const say = (m: Msg) => setMsgs((list) => [...list, m]);

  const askTopic = (id: HelperTopicId, label: string) => {
    say({ from: "me", text: label });
    const a = answerFor(id, info);
    say({ from: "bot", text: a.text, links: a.links, chips: id !== "buscar" });
  };

  const send = async (raw: string) => {
    const q = raw.trim().slice(0, 120);
    if (!q || busy) return;
    setText("");
    say({ from: "me", text: q });
    const topic = routeText(q);
    if (topic) {
      const a = answerFor(topic, info);
      say({ from: "bot", text: a.text, links: a.links, chips: true });
      return;
    }
    const term = searchTerm(q);
    if (term.length < 2) {
      say({ from: "bot", text: "No te entendí bien. Probá con el nombre de un producto o elegí un tema.", chips: true });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(term)}`);
      const data = (await res.json()) as { results?: SearchSuggestion[] };
      const results = (data.results ?? []).slice(0, 4);
      if (results.length > 0) {
        say({ from: "bot", text: "Mirá lo que tenemos:", products: results });
        say({ from: "bot", text: "¿Querés ver más? Podés ir al catálogo completo.", links: [{ label: `Ver todo «${term}»`, href: `/productos?q=${encodeURIComponent(term)}` }] });
      } else {
        say({
          from: "bot",
          text: "No encontré ese producto. Mariel puede conseguirlo: escribile por WhatsApp.",
          links: whatsappNumber ? [{ label: "Escribirle a Mariel", href: buildWhatsAppUrl(whatsappNumber, `¡Hola Mariel! Estoy buscando: ${q}`) }] : undefined,
          chips: true,
        });
      }
    } catch {
      say({ from: "bot", text: "No pude buscar ahora. Probá de nuevo en un ratito.", chips: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-28 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-coral-deep px-4 py-3 font-bold text-white shadow-lift transition active:scale-95 md:right-5 md:bottom-5 md:left-auto"
        >
          <MessageCircleQuestion className="size-5" aria-hidden="true" /> ¿Te ayudo?
        </button>
      )}

      {open ? (
        <div
          role="dialog"
          aria-label="Ayudante de Natu Mariel"
          className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(34rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-3xl border border-line bg-warm-white shadow-lift md:right-5 md:bottom-5 md:left-auto md:w-96"
        >
          <div className="flex items-center gap-3 bg-coral-deep px-4 py-3 text-white">
            <span className="grid size-9 place-items-center rounded-full bg-white text-lg" aria-hidden="true">🌷</span>
            <div className="min-w-0 flex-1 leading-tight">
              <b className="block">Ayudante de Natu Mariel</b>
              <small className="opacity-90">Te respondo al toque</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full hover:bg-white/15">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain p-3.5">
            {msgs.map((m, i) =>
              m.from === "me" ? (
                <p key={i} className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-coral-deep px-3.5 py-2 text-white">{m.text}</p>
              ) : (
                <div key={i} className="flex max-w-[92%] flex-col gap-2 self-start">
                  <p className="rounded-2xl rounded-bl-md bg-blush px-3.5 py-2">{m.text}</p>
                  {m.products?.map((p) => (
                    <HelperProduct key={p.slug} p={p} onGo={() => setOpen(false)} />
                  ))}
                  {m.links?.map((l) =>
                    l.href.startsWith("http") ? (
                      <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="self-start rounded-full border-2 border-coral-deep px-3.5 py-1.5 text-sm font-bold text-coral-deep">
                        {l.label}
                      </a>
                    ) : (
                      <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="self-start rounded-full border-2 border-coral-deep px-3.5 py-1.5 text-sm font-bold text-coral-deep">
                        {l.label}
                      </Link>
                    ),
                  )}
                  {m.chips && i === msgs.length - 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {HELPER_TOPICS.map((t) => (
                        <button key={t.id} type="button" onClick={() => askTopic(t.id, t.label)} className="rounded-full border-[1.5px] border-coral-deep px-3 py-1.5 text-sm font-bold text-coral-deep active:bg-blush">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {busy ? <p className="self-start rounded-2xl bg-blush px-3.5 py-2 text-muted">Buscando…</p> : null}
            <div ref={endRef} />
          </div>

          <form
            className="flex gap-2 border-t border-line p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={120}
              placeholder="Escribí tu pregunta…"
              aria-label="Escribí tu pregunta"
              className="min-w-0 flex-1 rounded-full border border-line bg-cream px-4 py-2.5 text-base outline-none focus:border-coral-deep"
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Enviar" className="grid size-11 place-items-center rounded-full bg-coral-deep text-white disabled:opacity-40">
              <Send className="size-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function HelperProduct({ p, onGo }: { p: SearchSuggestion; onGo: () => void }) {
  const src = p.image ? productImageUrl(p.image) : null;
  return (
    <Link href={`/productos/${p.slug}`} onClick={onGo} className="flex items-center gap-3 rounded-2xl border border-line bg-warm-white p-2">
      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white">
        {src ? <Image src={src} alt="" fill sizes="96px" className="object-cover" /> : <ProductImageFallback className="size-full" />}
      </span>
      <span className="min-w-0 leading-tight">
        <b className="line-clamp-2 text-sm">{p.name}</b>
        <span className="font-bold text-coral-deep">{formatARS(toCents(p.salePrice))}</span>
      </span>
    </Link>
  );
}
