"use client";

import { CalendarHeart, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCampaign, saveCampaign, searchAdminProducts, type AdminSearchOption } from "@/app/admin/actions";
import { ProductImageFallback } from "@/components/store/product-card";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { isActive, PRESETS, presetFor, type Campaign } from "@/lib/campaigns";
import { productImageUrl } from "@/lib/images";
import { ConfirmDialog } from "./confirm-dialog";

type Picked = { id: string; name: string; image: string | null };

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "UTC" });
const fmt = (d: string) => dateFmt.format(new Date(`${d}T12:00:00Z`));

function statusOf(c: Campaign, today: string) {
  if (isActive(c, today)) return { label: "Se ve en la tienda", tone: "bg-sage text-botanical-deep" };
  if (c.starts_on > today) return { label: "Próxima", tone: "bg-sun text-forest" };
  return { label: "Terminada", tone: "bg-cream text-muted" };
}

/** Lista de fechas especiales + formulario para crear o editar una. */
export function CampaignEditor({
  campaigns,
  products,
  today,
}: {
  campaigns: Campaign[];
  /** Nombre y foto de los productos elegidos en alguna fecha (para mostrarlos al editar). */
  products: Picked[];
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [removing, setRemoving] = useState<Campaign | null>(null);
  const known = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="mt-6">
      {editing ? (
        <CampaignForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          initialProducts={editing === "new" ? [] : editing.product_ids.map((id) => known.get(id)).filter((p): p is Picked => Boolean(p))}
          today={today}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className={buttonClasses("primary", "md")}>
          <Plus className="size-4" aria-hidden="true" /> Nueva fecha especial
        </button>
      )}

      {campaigns.length === 0 && !editing ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-8 text-center">
          <CalendarHeart className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">Todavía no hay fechas especiales</p>
          <p className="mt-1 text-sm text-muted">Creá una (por ejemplo, el Día de la Madre) y elegí qué productos mostrar.</p>
        </div>
      ) : null}

      <ul className="mt-6 flex flex-col gap-3">
        {campaigns.map((c) => {
          const s = statusOf(c, today);
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold">{c.title}</p>
                <p className="text-sm text-muted">
                  Del {fmt(c.starts_on)} al {fmt(c.ends_on)} · {c.product_ids.length}{" "}
                  {c.product_ids.length === 1 ? "producto" : "productos"}
                </p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${s.tone}`}>{s.label}</span>
              </div>
              {isActive(c, today) ? (
                <a href={`/especial/${c.slug}`} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "sm")}>
                  Ver en la tienda
                </a>
              ) : null}
              <button type="button" onClick={() => setEditing(c)} className={buttonClasses("ghost", "sm")} aria-label={`Editar ${c.title}`}>
                <Pencil className="size-4" aria-hidden="true" /> Editar
              </button>
              <button
                type="button"
                onClick={() => setRemoving(c)}
                disabled={pending}
                className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-coral-soft hover:text-coral-deep"
                aria-label={`Borrar ${c.title}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={removing !== null}
        title={`¿Borrar «${removing?.title ?? ""}»?`}
        description="Deja de verse en la tienda. Los productos no se tocan."
        confirmLabel="Borrar"
        pending={pending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          start(async () => {
            const res = await deleteCampaign(removing?.id);
            setRemoving(null);
            if (res.ok) {
              toast.success(res.message ?? "Borrada.");
              router.refresh();
            } else toast.error(res.error);
          })
        }
      />
    </div>
  );
}

function CampaignForm({
  initial,
  initialProducts,
  today,
  onDone,
  onCancel,
}: {
  initial: Campaign | null;
  initialProducts: Picked[];
  today: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? today);
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? today);
  const [picked, setPicked] = useState<Picked[]>(initialProducts);
  const [saving, start] = useTransition();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ term: string; list: AdminSearchOption[] }>({ term: "", list: [] });
  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      const list = await searchAdminProducts(term);
      if (alive) setResults({ term, list });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term]);
  const shown = results.term === term && term.length >= 2 ? results.list : [];
  const pickedIds = new Set(picked.map((p) => p.id));

  const save = () =>
    start(async () => {
      const res = await saveCampaign({
        id: initial?.id,
        title,
        message,
        starts_on: startsOn,
        ends_on: endsOn,
        product_ids: picked.map((p) => p.id),
      });
      if (res.ok) {
        toast.success(res.message ?? "Guardada.");
        onDone();
      } else toast.error(res.error);
    });

  return (
    <form
      className="rounded-3xl border-2 border-dashed border-botanical/60 bg-sage/20 p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-xl font-bold">{initial ? "Editar fecha especial" : "Nueva fecha especial"}</p>
        <button type="button" onClick={onCancel} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-white" aria-label="Cancelar">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {!initial ? (
        <div className="mt-3">
          <p className="text-sm font-semibold">Elegí una fecha típica (completa el nombre y las fechas):</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.title}
                type="button"
                onClick={() => {
                  const v = presetFor(p, today);
                  setTitle(v.title);
                  setMessage(v.message);
                  setStartsOn(v.starts_on);
                  setEndsOn(v.ends_on);
                }}
                className="rounded-full border border-line bg-white px-3 py-1 text-sm font-bold hover:bg-sun"
              >
                {p.emoji} {p.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          Nombre (se ve en la tienda)
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={60} placeholder="💐 Día de la Madre" className={`${inputClasses} mt-1 h-11`} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Mensaje (opcional)
          <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} placeholder="Regalos elegidos para mamá" className={`${inputClasses} mt-1 h-11`} />
        </label>
        <label className="text-sm font-semibold">
          Se muestra desde
          <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required className={`${inputClasses} mt-1 h-11`} />
        </label>
        <label className="text-sm font-semibold">
          Hasta (inclusive)
          <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required className={`${inputClasses} mt-1 h-11`} />
        </label>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold">Productos ({picked.length})</p>
        {picked.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {picked.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-full bg-white py-1 pr-1 pl-1 text-sm ring-1 ring-line">
                <Thumb image={p.image} />
                <span className="max-w-48 truncate">{p.name}</span>
                <button
                  type="button"
                  onClick={() => setPicked((list) => list.filter((x) => x.id !== p.id))}
                  className="inline-flex size-7 items-center justify-center rounded-full hover:bg-coral-soft"
                  aria-label={`Sacar ${p.name}`}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">Buscá y tocá los productos que querés mostrar.</p>
        )}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto para agregar (ej.: kaiak)"
            aria-label="Buscar producto para agregar"
            className={`${inputClasses} h-11 pl-9`}
          />
        </div>
        {shown.length > 0 ? (
          <ul className="mt-2 max-h-72 overflow-y-auto rounded-2xl bg-white p-1 ring-1 ring-line">
            {shown.map((p) => {
              const on = pickedIds.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={on}
                    onClick={() => setPicked((list) => [...list, { id: p.id, name: p.name, image: p.image }])}
                    className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-cream disabled:opacity-50"
                  >
                    <Thumb image={p.image} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                    <span className="text-xs text-muted">{on ? "Ya está" : p.stock > 0 ? `Stock ${p.stock}` : "Sin stock"}</span>
                    {!on ? <Plus className="size-4 text-botanical-deep" aria-hidden="true" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : term.length >= 2 && results.term === term ? (
          <p className="mt-2 text-sm text-muted">No hay productos con «{term}».</p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={buttonClasses("primary", "md")}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Guardar
        </button>
        <button type="button" onClick={onCancel} className={buttonClasses("ghost", "md")}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Thumb({ image }: { image: string | null }) {
  const src = image ? productImageUrl(image) : null;
  return (
    <span className="relative size-8 shrink-0 overflow-hidden rounded-full bg-cream">
      {src ? <Image src={src} alt="" fill sizes="32px" className="object-cover" /> : <ProductImageFallback className="size-full" />}
    </span>
  );
}
