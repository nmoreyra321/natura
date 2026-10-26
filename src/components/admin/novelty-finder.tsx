"use client";

import { Check, Loader2, PackagePlus, Search, Square } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { addNaturaNoveltyStep, findNaturaNovelties, finishNaturaPhotos, type NaturaNovelties } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/** De a cuántos códigos se consulta Natura al mismo tiempo. */
const PARALLEL = 3;

type Added = { id: string; name: string; category: string | null };
type Counts = { added: number; variant: number; noPrice: number; gone: number; already: number; failed: number };
const EMPTY: Counts = { added: 0, variant: 0, noPrice: 0, gone: 0, already: 0, failed: 0 };

const CATEGORY_NAMES: Record<string, string> = {
  perfumeria: "Perfumería",
  "cuerpo-y-bano": "Cuerpo y baño",
  rostro: "Rostro",
  cabello: "Cabello",
  "proteccion-solar": "Protección solar",
  kits: "Kits y regalos",
  hombre: "Hombre",
  maquillajes: "Maquillajes",
  infantiles: "Infantiles",
  accesorios: "Accesorios",
};

/**
 * Busca productos que Natura tiene y la tienda todavía no, y los agrega (publicados, sin stock, con su
 * categoría, línea, precio de revista y fotos). Los que ya estaban, o son otro tono de uno existente, no se repiten.
 */
export function NoveltyFinder() {
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<NaturaNovelties | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [added, setAdded] = useState<Added[]>([]);
  const [finished, setFinished] = useState(false);
  const stopRef = useRef(false);

  const search = async () => {
    setSearching(true);
    setFinished(false);
    setFound(null);
    const res = await findNaturaNovelties();
    setSearching(false);
    if (res.ok && res.data) setFound(res.data);
    else toast.error(res.ok ? "No pudimos consultar Natura." : res.error);
  };

  const start = async () => {
    if (!found) return;
    stopRef.current = false;
    setRunning(true);
    setFinished(false);
    setDone(0);
    setCounts(EMPTY);
    setAdded([]);

    const queue = [...found.pending];
    let blocked = 0;
    let checked = 0;
    const bump = (key: keyof Counts) => setCounts((c) => ({ ...c, [key]: c[key] + 1 }));
    const worker = async () => {
      for (let sku = queue.shift(); sku && !stopRef.current; sku = queue.shift()) {
        const r = await addNaturaNoveltyStep(sku);
        checked++;
        if (r.status === "agregado" && r.id) {
          bump("added");
          const item = { id: r.id, name: r.name ?? sku, category: r.category ?? null };
          setAdded((list) => [...list, item]);
        } else if (r.status === "variante") bump("variant");
        else if (r.status === "sin_precio") bump("noPrice");
        else if (r.status === "no_disponible") bump("gone");
        else if (r.status === "ya_estaba") bump("already");
        else {
          bump("failed");
          if (r.status === "blocked") blocked++;
        }
        setDone((d) => d + 1);
        // Si Natura rechaza todo desde el principio, no tiene sentido seguir.
        if (checked >= 6 && blocked === checked) {
          stopRef.current = true;
          toast.error("Natura no nos deja entrar en este momento. Probá más tarde.");
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    await finishNaturaPhotos();
    setRunning(false);
    setFinished(true);
  };

  const total = found?.pending.length ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-3xl bg-warm-white p-5 shadow-soft">
      <h2 className="font-display text-xl font-bold">Productos nuevos de Natura</h2>
      <p className="mt-1 text-muted">
        Busca en naturacosmeticos.com.ar los productos que todavía no tenés en la tienda y los agrega. Quedan{" "}
        <strong className="text-forest">publicados y sin stock</strong>, con su precio de revista, su categoría y sus fotos
        (y el descuento de la categoría, si guardaste uno). Los que ya tenés no se tocan.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={search} disabled={searching || running} variant={found ? "outline" : "primary"}>
          {searching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
          {found ? "Buscar de nuevo" : "Buscar productos nuevos"}
        </Button>
      </div>

      {found ? (
        <div className="mt-4 rounded-2xl bg-cream p-4">
          <p className="font-semibold">
            Natura tiene {found.total} productos en su lista y vos tenés {found.have} con código.
          </p>
          {total > 0 ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Hay <strong className="text-forest">{total}</strong> códigos para revisar. Muchos son otros tonos de productos que
                ya tenés o fichas que Natura ya no vende, y esos se saltean solos. Tarda unos{" "}
                {Math.max(1, Math.round((total * 3) / PARALLEL / 60))} minutos: no cierres esta página.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {running ? (
                  <Button variant="outline" onClick={() => (stopRef.current = true)}>
                    <Square className="size-4" aria-hidden="true" /> Frenar
                  </Button>
                ) : (
                  <Button onClick={start}>
                    <PackagePlus className="size-4" aria-hidden="true" /> Agregar los nuevos
                  </Button>
                )}
                {running ? (
                  <span className="inline-flex items-center gap-2 text-sm text-muted tabular">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {done} de {total}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">No hay nada nuevo para revisar. ¡Está todo al día!</p>
          )}
        </div>
      ) : null}

      {running || finished ? (
        <>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-botanical-deep transition-all" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <li className="rounded-2xl bg-sage p-3 font-semibold text-botanical-deep">
              <Check className="mr-1 inline size-4" aria-hidden="true" /> Productos agregados: {counts.added}
            </li>
            <li className="rounded-2xl bg-cream p-3 font-semibold">Otros tonos de productos que ya tenés: {counts.variant + counts.already}</li>
            <li className="rounded-2xl bg-cream p-3 font-semibold">Sin precio en Natura (no se agregaron): {counts.noPrice}</li>
            <li className="rounded-2xl bg-cream p-3 font-semibold">Ya no están en Natura: {counts.gone}</li>
            {counts.failed > 0 ? <li className="rounded-2xl bg-coral-soft p-3 font-semibold">No se pudieron revisar: {counts.failed}</li> : null}
          </ul>
          {finished ? (
            <p className="mt-3 text-sm text-muted">
              {done < total ? "Se frenó antes de terminar. " : "¡Terminó! "}
              {counts.failed > 0 || done < total ? "Podés volver a buscar y agregar: sigue donde quedó. " : ""}
              {counts.added > 0 ? "Revisá los nuevos y poneles el stock cuando lleguen." : ""}
            </p>
          ) : null}
          {added.length > 0 ? (
            <details className="mt-3 text-sm" open={finished}>
              <summary className="cursor-pointer font-semibold text-coral-deep">Ver los productos agregados ({added.length})</summary>
              <ul className="mt-2 divide-y divide-line/70 overflow-hidden rounded-2xl bg-cream">
                {added.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/productos/${p.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white">
                      <span className="min-w-0 truncate font-semibold">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted">{p.category ? (CATEGORY_NAMES[p.category] ?? p.category) : "Sin categoría"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
