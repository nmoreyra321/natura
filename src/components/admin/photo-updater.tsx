"use client";

import { Check, ImageDown, Loader2, Square } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { finishNaturaPhotos, updateNaturaPhotosStep, type NaturaPhotoStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/** De a cuántos productos se consulta Natura al mismo tiempo. */
const PARALLEL = 3;

type Item = { id: string; name: string };
type Counts = Record<"ok" | "same" | "missing" | "own" | "failed", number>;
const EMPTY: Counts = { ok: 0, same: 0, missing: 0, own: 0, failed: 0 };

/**
 * Actualización general de fotos desde Natura: recorre los productos con código, trae las fotos
 * actuales de su ficha y reemplaza solo las que habían venido de Natura. Las fotos propias no se tocan.
 */
export function PhotoUpdater({ all, withoutPhoto }: { all: Item[]; withoutPhoto: Item[] }) {
  const [onlyMissing, setOnlyMissing] = useState(withoutPhoto.length > 0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [missing, setMissing] = useState<Item[]>([]);
  const [finished, setFinished] = useState(false);
  const stopRef = useRef(false);

  const list = onlyMissing ? withoutPhoto : all;
  const total = list.length;

  const start = async () => {
    stopRef.current = false;
    setRunning(true);
    setFinished(false);
    setDone(0);
    setCounts(EMPTY);
    setMissing([]);

    const queue = [...list];
    let blocked = 0;
    let checked = 0;
    const bump = (key: keyof Counts) => setCounts((c) => ({ ...c, [key]: c[key] + 1 }));
    const worker = async () => {
      for (let item = queue.shift(); item && !stopRef.current; item = queue.shift()) {
        const status: NaturaPhotoStatus = await updateNaturaPhotosStep(item.id);
        checked++;
        if (status === "ok") bump("ok");
        else if (status === "same" || status === "full") bump("same");
        else if (status === "own_photos") bump("own");
        else if (status === "not_found" || status === "no_images" || status === "no_code") {
          bump("missing");
          const missed = item;
          setMissing((m) => [...m, missed]);
        } else {
          bump("failed");
          if (status === "blocked") blocked++;
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

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-3xl bg-warm-white p-5 shadow-soft">
      <h2 className="font-display text-xl font-bold">Fotos de Natura</h2>
      <p className="mt-1 text-muted">
        Trae las fotos actuales de cada producto desde naturacosmeticos.com.ar (por su código) y reemplaza las que habían
        venido de Natura. <strong className="text-forest">Las fotos que subiste vos no se tocan</strong>, y si la foto no
        cambió, el producto queda igual.
      </p>

      <fieldset className="mt-4 flex flex-col gap-2" disabled={running}>
        <legend className="sr-only">Qué productos revisar</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="fotos-cuales" checked={onlyMissing} onChange={() => setOnlyMissing(true)} className="mt-1 accent-forest" />
          <span>
            <span className="font-semibold">Solo los que no tienen foto</span>{" "}
            <span className="text-sm text-muted">({withoutPhoto.length})</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="fotos-cuales" checked={!onlyMissing} onChange={() => setOnlyMissing(false)} className="mt-1 accent-forest" />
          <span>
            <span className="font-semibold">Todos los productos con código de Natura</span>{" "}
            <span className="text-sm text-muted">({all.length} · tarda unos {Math.max(1, Math.round((all.length * 3) / PARALLEL / 60))} minutos)</span>
          </span>
        </label>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {running ? (
          <Button variant="outline" onClick={() => (stopRef.current = true)}>
            <Square className="size-4" aria-hidden="true" /> Frenar
          </Button>
        ) : (
          <Button onClick={start} disabled={total === 0}>
            <ImageDown className="size-4" aria-hidden="true" /> Actualizar fotos ({total})
          </Button>
        )}
        {running ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted tabular">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {done} de {total} · no cierres esta página
          </span>
        ) : null}
      </div>

      {running || finished ? (
        <>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-botanical-deep transition-all" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <li className="rounded-2xl bg-sage p-3 font-semibold text-botanical-deep">
              <Check className="mr-1 inline size-4" aria-hidden="true" /> Fotos nuevas: {counts.ok}
            </li>
            <li className="rounded-2xl bg-cream p-3 font-semibold">Ya estaban al día: {counts.same}</li>
            <li className="rounded-2xl bg-cream p-3 font-semibold">Con fotos tuyas (no se tocaron): {counts.own}</li>
            <li className="rounded-2xl bg-sun/50 p-3 font-semibold">No están en Natura: {counts.missing}</li>
            {counts.failed > 0 ? <li className="rounded-2xl bg-coral-soft p-3 font-semibold">No se pudieron revisar: {counts.failed}</li> : null}
          </ul>
          {finished ? (
            <p className="mt-3 text-sm text-muted">
              {done < total ? "Se frenó antes de terminar. " : "¡Terminó! "}
              {counts.failed > 0 ? "Podés volver a tocar «Actualizar fotos» más tarde para los que fallaron." : ""}
            </p>
          ) : null}
          {missing.length > 0 ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-coral-deep">Ver los que no están en Natura ({missing.length})</summary>
              <ul className="mt-2 list-disc pl-5 text-muted">
                {missing.map((m) => (
                  <li key={m.id}>
                    <a href={`/admin/productos/${m.id}`} className="hover:text-coral-deep hover:underline">
                      {m.name}
                    </a>
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
