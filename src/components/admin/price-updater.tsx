"use client";

import { AlertTriangle, Check, Loader2, RefreshCw, Square } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { applyNaturaPrices, checkNaturaPrices, type NaturaPriceCheck } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { formatARS } from "@/lib/format";
import { planMagazinePriceUpdate, toCents } from "@/lib/pricing";

const BATCH = 20;

type Change = NaturaPriceCheck & { newMagazine: number };

export function PriceUpdater({ productIds }: { productIds: string[] }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [changes, setChanges] = useState<Change[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notFound, setNotFound] = useState<NaturaPriceCheck[]>([]);
  const [failed, setFailed] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [applying, setApplying] = useState(false);
  const stopRef = useRef(false);

  const start = async () => {
    stopRef.current = false;
    setRunning(true);
    setFinished(false);
    setDone(0);
    setChanges([]);
    setSelected(new Set());
    setNotFound([]);
    setFailed(0);
    setBlocked(false);

    let blockedCount = 0;
    let checked = 0;
    for (let i = 0; i < productIds.length && !stopRef.current; i += BATCH) {
      const res = await checkNaturaPrices(productIds.slice(i, i + BATCH));
      if (!res.ok) {
        toast.error(res.error);
        break;
      }
      const results = res.data ?? [];
      const newChanges: Change[] = [];
      const missing: NaturaPriceCheck[] = [];
      let errors = 0;
      for (const r of results) {
        if (r.result.status === "ok") {
          if (toCents(r.result.magazinePrice) !== toCents(r.magazinePrice)) {
            newChanges.push({ ...r, newMagazine: r.result.magazinePrice });
          }
        } else if (r.result.status === "not_found") {
          missing.push(r);
        } else {
          errors++;
          if (r.result.status === "blocked") blockedCount++;
        }
      }
      checked += results.length;
      setChanges((prev) => [...prev, ...newChanges]);
      setSelected((prev) => new Set([...prev, ...newChanges.map((c) => c.id)]));
      setNotFound((prev) => [...prev, ...missing]);
      setFailed((prev) => prev + errors);
      setDone(Math.min(i + BATCH, productIds.length));
      // Si Natura rechaza todo el primer grupo, no tiene sentido seguir.
      if (checked > 0 && blockedCount === checked) {
        setBlocked(true);
        break;
      }
    }
    setRunning(false);
    setFinished(true);
  };

  const apply = async () => {
    const list = changes.filter((c) => selected.has(c.id));
    if (list.length === 0) return;
    setApplying(true);
    let total = 0;
    for (let i = 0; i < list.length; i += 100) {
      const res = await applyNaturaPrices(list.slice(i, i + 100).map((c) => ({ id: c.id, magazinePrice: c.newMagazine })));
      if (!res.ok) {
        toast.error(res.error);
        break;
      }
      total += res.data?.updated ?? 0;
    }
    setApplying(false);
    if (total > 0) {
      toast.success(`Actualizamos ${total} ${total === 1 ? "precio" : "precios"}.`);
      const applied = new Set(list.map((c) => c.id));
      setChanges((prev) => prev.filter((c) => !applied.has(c.id)));
      setSelected(new Set());
    }
  };

  const allSelected = changes.length > 0 && changes.every((c) => selected.has(c.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-warm-white p-5 shadow-soft">
        {running ? (
          <Button variant="outline" onClick={() => (stopRef.current = true)}>
            <Square className="size-4" aria-hidden="true" /> Detener
          </Button>
        ) : (
          <Button onClick={start} disabled={productIds.length === 0}>
            <RefreshCw className="size-4" aria-hidden="true" /> Buscar precios nuevos en Natura
          </Button>
        )}
        <div className="min-w-48 flex-1">
          <div
            className="h-3 overflow-hidden rounded-full bg-cream"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={productIds.length}
            aria-valuenow={done}
            aria-label="Productos revisados"
          >
            <div className="h-full bg-botanical transition-[width]" style={{ width: `${productIds.length ? (done / productIds.length) * 100 : 0}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted tabular" aria-live="polite">
            {running ? <Loader2 className="mr-1 inline size-3.5 animate-spin" aria-hidden="true" /> : null}
            {done} de {productIds.length} productos revisados
            {changes.length ? ` · ${changes.length} con precio nuevo` : ""}
          </p>
        </div>
      </div>

      {blocked ? (
        <div className="flex gap-3 rounded-3xl border border-coral/40 bg-coral-soft p-4" role="alert">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral-deep" aria-hidden="true" />
          <p>
            El sitio de Natura rechazó las consultas desde el servidor de la tienda. Probá de nuevo más tarde; si sigue
            pasando, los precios se pueden actualizar a mano desde cada producto.
          </p>
        </div>
      ) : null}

      {finished && !blocked && changes.length === 0 ? (
        <p className="flex items-center gap-2 rounded-3xl bg-sage p-4 font-semibold text-botanical-deep">
          <Check className="size-5" aria-hidden="true" /> Todos los precios revisados coinciden con Natura.
        </p>
      ) : null}

      {changes.length > 0 ? (
        <section aria-labelledby="cambios" className="rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="cambios" className="font-display text-xl font-bold">
              Precios nuevos ({changes.length})
            </h2>
            <Button onClick={apply} disabled={applying || running || selected.size === 0}>
              {applying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
              Aplicar {selected.size} {selected.size === 1 ? "cambio" : "cambios"}
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted">
            Si el precio especial era igual al de revista, acompaña el cambio. Si pusiste un precio especial propio, se
            mantiene.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="w-10 py-2">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? new Set(changes.map((c) => c.id)) : new Set())}
                      className="size-5 accent-[var(--coral-deep)]"
                    />
                  </th>
                  <th className="py-2">Producto</th>
                  <th className="py-2 text-right">Revista actual</th>
                  <th className="py-2 text-right">Revista nueva</th>
                  <th className="py-2 text-right">Especial queda en</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => {
                  const plan = planMagazinePriceUpdate(
                    { magazine_price: c.magazinePrice, sale_price: c.salePrice, is_offer: c.isOffer },
                    c.newMagazine,
                  );
                  const up = c.newMagazine > c.magazinePrice;
                  return (
                    <tr key={c.id} className="border-b border-line/60 last:border-b-0">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          aria-label={`Aplicar precio nuevo a ${c.name}`}
                          checked={selected.has(c.id)}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(c.id);
                              else next.delete(c.id);
                              return next;
                            })
                          }
                          className="size-5 accent-[var(--coral-deep)]"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Link href={`/admin/productos/${c.id}`} className="font-semibold hover:text-coral-deep">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2 text-right tabular text-muted">{formatARS(toCents(c.magazinePrice))}</td>
                      <td className={`py-2 text-right font-bold tabular ${up ? "text-coral-deep" : "text-botanical-deep"}`}>
                        {formatARS(toCents(c.newMagazine))} {up ? "▲" : "▼"}
                      </td>
                      <td className="py-2 text-right tabular">
                        {formatARS(toCents(plan.sale_price))}
                        {c.isOffer && !plan.is_offer ? <span className="block text-xs text-muted">deja de ser oferta</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {notFound.length > 0 ? (
        <section aria-labelledby="no-encontrados" className="rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5">
          <h2 id="no-encontrados" className="font-display text-xl font-bold">
            Ya no están en Natura ({notFound.length})
          </h2>
          <p className="mt-1 text-sm text-muted">
            Natura ya no muestra estos productos o no tienen precio. Revisá si querés despublicarlos.
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {notFound.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/productos/${p.id}`} className="font-semibold hover:text-coral-deep">
                  {p.name}
                </Link>{" "}
                <span className="text-muted">({p.sku})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {failed > 0 && !blocked ? (
        <p className="text-sm text-muted">
          {failed} {failed === 1 ? "producto no se pudo" : "productos no se pudieron"} consultar. Volvé a buscar en un rato.
        </p>
      ) : null}
    </div>
  );
}
