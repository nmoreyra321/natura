"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveMonthlyGoal } from "@/app/admin/actions";
import { celebrate } from "@/lib/celebrate";
import { formatARS } from "@/lib/format";

const R = 62;
const LEN = 2 * Math.PI * R;

/** Meta del mes: un círculo que se llena con lo vendido. Al llegar a la meta hay fiesta (una vez por mes). */
export function MonthGoal({ monthKey, soldCents, goalPesos }: { monthKey: string; soldCents: number; goalPesos: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(goalPesos > 0 ? String(goalPesos) : "");
  const [pct, setPct] = useState(0);
  const goalCents = goalPesos * 100;
  const real = goalCents > 0 ? Math.min(soldCents / goalCents, 1) : 0;

  useEffect(() => {
    // Primero vacío y después se llena, para que se vea la animación.
    const t = setTimeout(() => setPct(real), 250);
    return () => clearTimeout(t);
  }, [real]);

  useEffect(() => {
    if (goalCents <= 0 || soldCents < goalCents) return;
    const key = `meta-festejada-${monthKey}-${goalPesos}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      /* sin almacenamiento: se festeja igual */
    }
    celebrate("confetti");
  }, [monthKey, soldCents, goalCents, goalPesos]);

  const save = () =>
    start(async () => {
      const res = await saveMonthlyGoal(value);
      if (res.ok) {
        toast.success(res.message ?? "Listo.");
        setEditing(false);
        router.refresh();
      } else toast.error(res.error);
    });

  if (goalPesos <= 0 && !editing) {
    return (
      <section className="rounded-3xl bg-warm-white p-5 shadow-soft">
        <h2 className="font-display text-xl font-bold">🎯 Meta del mes</h2>
        <p className="mt-1 text-base text-muted">Elegí cuánto querés vender este mes y mirá cómo se llena el círculo.</p>
        <button type="button" onClick={() => setEditing(true)} className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-coral-deep text-lg font-extrabold text-white shadow-soft">
          Poner una meta
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-warm-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">🎯 Meta del mes</h2>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 font-bold text-muted hover:bg-forest/5">
            <Pencil className="size-4" aria-hidden="true" /> Cambiar
          </button>
        ) : null}
      </div>
      {editing ? (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="text-base font-semibold" htmlFor="meta-mes">
            ¿Cuánto querés vender este mes? ($)
          </label>
          <input
            id="meta-mes"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ej.: 300000"
            className="h-14 rounded-2xl border-2 border-line bg-white px-4 text-xl font-bold tabular"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="min-h-12 flex-1 rounded-full bg-coral-deep text-lg font-extrabold text-white disabled:opacity-60">
              Guardar meta
            </button>
            <button type="button" onClick={() => setEditing(false)} className="min-h-12 rounded-full border-2 border-line px-5 font-bold">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="relative size-40">
            <svg viewBox="0 0 150 150" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="75" cy="75" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
              <circle
                cx="75"
                cy="75"
                r={R}
                fill="none"
                stroke="var(--coral-deep)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={LEN}
                strokeDashoffset={LEN * (1 - pct)}
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.2,0.8,0.2,1)" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-bold">{Math.round(real * 100)}%</span>
          </div>
          <p className="text-center text-base">
            {soldCents >= goalCents ? (
              <strong>¡Llegaste a la meta! 🎉</strong>
            ) : (
              <>
                Llevás <strong>{formatARS(soldCents)}</strong> de {formatARS(goalCents)}
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
