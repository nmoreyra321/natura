"use client";

import { AlertTriangle, Camera, CheckCircle2, FileText, ImagePlus, Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  applyReceipt,
  readReceipt,
  searchProductsForSale,
  type ReceiptInvoice,
  type ReceiptLine,
  type ReceiptMatch,
  type ReceiptRead,
  type SaleProductOption,
} from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { ProductImageFallback } from "@/components/store/product-card";
import { NaturaPhoto } from "./natura-photo";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { titleCase } from "@/lib/receipt";
import { parseMoney } from "@/lib/validation";

const MAX_PHOTOS = 3;
const MAX_SIDE = 1800;
const MAX_PDF_BYTES = 4_000_000;

/** Foto ya achicada o PDF de la factura, listo para enviar. */
type Upload = { blob: Blob; url: string; pdfName?: string };

type Row = {
  key: string;
  code: string;
  description: string;
  quantity: number;
  /** Producto de la tienda al que se suma, o null si hay que crearlo. */
  match: ReceiptMatch | null;
  mode: "existing" | "new";
  /** Elegido por parecido del nombre: hay que confirmar que es ese producto. */
  unsure: boolean;
  /** Caja o kit en el que vino, según la factura. */
  kit: string;
  newName: string;
  newPrice: string;
};

type Done = { units: number; updated: number; created: { id: string; name: string; sku: string | null }[] };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" });
const showDate = (iso: string) => dateFmt.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));

const EMPTY_DONE: Done = { units: 0, updated: 0, created: [] };

const addDone = (a: Done, b: Done): Done => ({ units: a.units + b.units, updated: a.updated + b.updated, created: [...a.created, ...b.created] });

/** Un renglón revisado, tal como lo espera la acción que suma el stock. */
function toLine(r: Row) {
  return r.mode === "existing" && r.match
    ? { kind: "existing" as const, productId: r.match.id, quantity: r.quantity, description: r.description }
    : { kind: "new" as const, name: r.newName, code: r.code, price: parseMoney(r.newPrice), quantity: r.quantity, description: r.description };
}

/** Qué le falta a un renglón para poder cargarlo (null si está listo). */
function pendingReason(r: Row): string | null {
  if (r.mode === "existing" && r.match && r.unsure) {
    return `Confirmá si «${r.description}» es «${r.match.name}» (tocá «Sí, es este» o «No»).`;
  }
  if (r.mode === "existing" && !r.match) return `Elegí a qué producto corresponde «${r.description}», o crealo como nuevo.`;
  return null;
}

/** Achica la foto en el teléfono (las fotos de cámara pesan mucho) y la pasa a JPG. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toRow(line: ReceiptLine, i: number): Row {
  return {
    key: `${i}-${line.code}`,
    code: line.code,
    description: line.description,
    quantity: line.quantity,
    match: line.match,
    mode: line.match ? "existing" : "new",
    unsure: line.unsure,
    kit: line.kit,
    newName: titleCase(line.description),
    newPrice: line.unitPrice ? String(line.unitPrice).replace(".", ",") : "",
  };
}

function Thumb({ image }: { image: string | null }) {
  const src = image ? productImageUrl(image) : null;
  return (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white">
      {src ? <Image src={src} alt="" fill sizes="56px" className="object-cover" /> : <ProductImageFallback className="size-full" />}
    </span>
  );
}

/** Buscador de productos de la tienda (para vincular un renglón o agregar uno que faltó). */
function ProductPicker({ onPick, placeholder }: { onPick: (p: SaleProductOption) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SaleProductOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchProductsForSale(term);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);
  const visible = q.trim().length >= 2 ? results : [];

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSearching(e.target.value.trim().length >= 2);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          className={`${inputClasses} h-11 pl-10`}
        />
        {searching ? <Loader2 className="absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2 animate-spin text-muted" aria-hidden="true" /> : null}
      </div>
      {visible.length > 0 ? (
        <ul className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-line bg-white p-1">
          {visible.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  setQ("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sun/40"
              >
                <Thumb image={p.image} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">Hoy tenés {p.stock}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 && !searching ? (
        <p className="mt-2 text-sm text-muted">No encontramos productos con ese nombre.</p>
      ) : null}
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const btn = "inline-flex size-10 items-center justify-center rounded-full border-2 border-forest bg-white hover:bg-sun disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Uno menos">
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={1000}
        value={value}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.min(Math.max(n, 1), 1000));
        }}
        aria-label="Cantidad"
        className="h-10 w-16 rounded-xl border border-line bg-white text-center text-lg font-bold tabular"
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= 1000} aria-label="Uno más">
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Carga de stock desde la foto de la boleta de Natura: leer → revisar → confirmar. */
export function ReceiptImport() {
  const [photos, setPhotos] = useState<Upload[]>([]);
  const [preparing, setPreparing] = useState(false);
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  /** Datos de la factura leída y el registro del historial al que se suma lo cargado. */
  const [invoice, setInvoice] = useState<ReceiptInvoice | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [previous, setPrevious] = useState<ReceiptRead["previous"]>(null);
  const [publish, setPublish] = useState(true);
  const [done, setDone] = useState<Done | null>(null);
  /** Lo que ya se cargó de a uno (antes de terminar la lista). */
  const [applied, setApplied] = useState<Done>(EMPTY_DONE);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPreparing(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const picked = [...files].slice(0, room);
      if (files.length > room) toast.message(`Podés subir hasta ${MAX_PHOTOS} fotos por boleta.`);
      const ready: Upload[] = [];
      for (const f of picked) {
        if (f.type === "application/pdf") {
          if (f.size > MAX_PDF_BYTES) toast.error("El PDF pesa demasiado (máximo 4 MB).");
          else ready.push({ blob: f, url: URL.createObjectURL(f), pdfName: f.name });
          continue;
        }
        try {
          const blob = await shrinkPhoto(f);
          ready.push({ blob, url: URL.createObjectURL(blob) });
        } catch {
          toast.error("No pudimos abrir una de las fotos. Probá sacarla de nuevo.");
        }
      }
      setPhotos((prev) => [...prev, ...ready]);
    } finally {
      setPreparing(false);
    }
  };

  const removePhoto = (i: number) =>
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });

  const read = () =>
    startReading(async () => {
      const fd = new FormData();
      photos.forEach((p, i) => fd.append("foto", p.blob, p.pdfName ? `factura-${i + 1}.pdf` : `boleta-${i + 1}.jpg`));
      const res = await readReceipt(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data!;
      setRows(data.lines.map(toRow));
      setInvoice(data.invoice);
      setPrevious(data.previous);
      setReceiptId(data.previous?.id ?? crypto.randomUUID());
    });

  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? prev);
  const remove = (key: string) => setRows((prev) => prev?.filter((r) => r.key !== key) ?? prev);
  const linkTo = (key: string, p: SaleProductOption) =>
    update(key, { mode: "existing", unsure: false, match: { id: p.id, name: p.name, size: p.size, stock: p.stock, image: p.image, status: "" } });
  const addMissing = (p: SaleProductOption) =>
    setRows((prev) => {
      const list = prev ?? [];
      const found = list.find((r) => r.mode === "existing" && r.match?.id === p.id);
      if (found) return list.map((r) => (r === found ? { ...r, quantity: r.quantity + 1 } : r));
      return [
        ...list,
        {
          key: `extra-${Date.now()}`,
          code: "",
          description: "",
          quantity: 1,
          match: { id: p.id, name: p.name, size: p.size, stock: p.stock, image: p.image, status: "" },
          mode: "existing",
          unsure: false,
          kit: "",
          newName: "",
          newPrice: "",
        },
      ];
    });

  const restart = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setRows(null);
    setDone(null);
    setApplied(EMPTY_DONE);
    setInvoice(null);
    setPrevious(null);
    setReceiptId(null);
  };

  const receiptMeta = () =>
    receiptId ? { id: receiptId, ...(invoice ?? { number: null, date: null, dueDate: null, total: null }) } : undefined;

  /** Carga un solo renglón y lo saca de la lista. */
  const confirmOne = async (r: Row) => {
    const reason = pendingReason(r);
    if (reason) {
      toast.error(reason);
      return;
    }
    setBusyKey(r.key);
    try {
      const res = await applyReceipt({ publish, lines: [toLine(r)], receipt: receiptMeta() });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const result = res.data ?? EMPTY_DONE;
      const total = addDone(applied, result);
      setApplied(total);
      toast.success(`Listo: se sumaron ${r.quantity} al stock.`);
      router.refresh();
      const rest = (rows ?? []).filter((x) => x.key !== r.key);
      if (rest.length === 0) {
        setDone(total);
        setRows(null);
      } else {
        setRows(rest);
      }
    } finally {
      setBusyKey(null);
    }
  };

  const confirm = () =>
    startSaving(async () => {
      if (!rows) return;
      const reason = rows.map(pendingReason).find(Boolean);
      if (reason) {
        toast.error(reason);
        return;
      }
      const res = await applyReceipt({ publish, lines: rows.map(toLine), receipt: receiptMeta() });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDone(addDone(applied, res.data ?? EMPTY_DONE));
      router.refresh();
      setRows(null);
    });

  /* ------------------------------- Listo ------------------------------- */
  if (done) {
    return (
      <div className="rounded-3xl bg-warm-white p-6 text-center shadow-soft">
        <CheckCircle2 className="mx-auto size-12 text-botanical-deep" aria-hidden="true" />
        <h2 className="mt-3 font-display text-2xl font-bold">¡Listo! Se cargó la boleta</h2>
        <p className="mt-2 text-muted">
          Se sumaron <strong className="text-forest">{done.units}</strong> unidades
          {done.updated > 0 ? ` a ${done.updated} ${done.updated === 1 ? "producto" : "productos"}` : ""}.
        </p>
        {done.created.length > 0 ? (
          <div className="mx-auto mt-5 max-w-md rounded-2xl bg-sun/40 p-4 text-left">
            <p className="font-bold">
              {done.created.length === 1 ? "Se creó 1 producto nuevo" : `Se crearon ${done.created.length} productos nuevos`} (todavía
              ocultos en la tienda):
            </p>
            <p className="mt-1 text-sm text-muted">
              Traé la foto oficial de Natura con el código (o pegando el enlace del producto en naturacosmeticos.com.ar), y
              publicalos cuando quieras.
            </p>
            <ul className="mt-3 flex flex-col gap-4">
              {done.created.map((p) => (
                <li key={p.id} className="flex flex-col gap-2">
                  <Link href={`/admin/productos/${p.id}`} className="font-semibold text-coral-deep underline">
                    {p.name}
                  </Link>
                  <NaturaPhoto productId={p.id} sku={p.sku} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button type="button" onClick={restart} className={buttonClasses("primary", "md", "mt-6")}>
          <Camera className="size-5" aria-hidden="true" /> Cargar otra boleta
        </button>
      </div>
    );
  }

  /* ------------------------------ Revisión ------------------------------ */
  if (rows) {
    const units = rows.reduce((s, r) => s + r.quantity, 0);
    const missing = rows.filter((r) => r.mode === "new").length;
    const toCheck = rows.filter((r) => r.mode === "existing" && r.match && r.unsure).length;
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-warm-white p-4 shadow-soft">
          <h2 className="font-display text-xl font-bold">Revisá la lista</h2>
          {invoice?.number || invoice?.date || invoice?.total ? (
            <p className="text-sm text-muted">
              {invoice.number ? `Factura N° ${invoice.number}` : "Factura"}
              {invoice.date ? ` del ${showDate(invoice.date)}` : ""}
              {invoice.total ? ` · total ${formatARS(Math.round(invoice.total * 100))}` : ""}
              {invoice.dueDate ? ` · vence el ${showDate(invoice.dueDate)}` : ""}
            </p>
          ) : null}
          {previous ? (
            <p className="mt-2 flex items-start gap-2 rounded-2xl bg-coral-soft p-3 text-sm font-semibold">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral-deep" aria-hidden="true" />
              Ojo: esta factura ya la cargaste el {showDate(previous.createdAt)} ({previous.units} unidades). Si la cargás de nuevo,
              se suma otra vez al stock. Cargá solo lo que te faltó.
            </p>
          ) : null}
          <p className="mt-1 text-muted">
            Encontramos <strong className="text-forest">{rows.length}</strong> productos ({units} unidades). Compará con la caja: si
            llegó uno más, tocá <strong>+</strong>; si llegó uno menos, tocá <strong>−</strong>; si no vino, tocá el tachito.
          </p>
          {applied.units > 0 ? (
            <p className="mt-2 rounded-2xl bg-sage p-3 text-sm font-semibold text-botanical-deep">
              Ya cargaste {applied.units} {applied.units === 1 ? "unidad" : "unidades"}. Quedan estos por revisar.
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted">
            Podés cargar de a uno con «Cargar este» los que ya tenés seguros, o todos juntos al final. Lo que confirmes queda guardado: la próxima factura reconoce sola esos nombres abreviados.
          </p>
          {toCheck > 0 ? (
            <p className="mt-2 flex items-start gap-2 rounded-2xl bg-sky-100 p-3 text-sm font-semibold">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {toCheck === 1 ? "Hay 1 producto" : `Hay ${toCheck} productos`} que reconocimos por el nombre abreviado: confirmá que
              sea el correcto.
            </p>
          ) : null}
          {missing > 0 ? (
            <p className="mt-2 flex items-start gap-2 rounded-2xl bg-sun/50 p-3 text-sm font-semibold">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {missing === 1 ? "Hay 1 producto que no está en la página" : `Hay ${missing} productos que no están en la página`}: se van a
              crear como nuevos (revisá el nombre y el precio), o buscá si ya están cargados con otro nombre.
            </p>
          ) : null}
        </div>

        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li
              key={r.key}
              className={`rounded-3xl bg-warm-white p-4 shadow-soft ${r.mode === "new" ? "border-2 border-sun" : r.unsure && r.match ? "border-2 border-sky-300" : ""}`}
            >
              <div className="flex items-start gap-3">
                {r.mode === "existing" && r.match ? <Thumb image={r.match.image} /> : null}
                <div className="min-w-0 flex-1">
                  {r.mode === "existing" && r.match ? (
                    <>
                      <p className="font-semibold leading-snug">{r.match.name}</p>
                      <p className="text-sm text-muted tabular">
                        Hoy tenés {r.match.stock} → quedan <strong className="text-forest">{r.match.stock + r.quantity}</strong>
                      </p>
                      {r.description && !r.unsure ? (
                        <button
                          type="button"
                          onClick={() => update(r.key, { match: null })}
                          className="text-xs font-bold text-coral-deep underline"
                        >
                          No es este, cambiar
                        </button>
                      ) : null}
                    </>
                  ) : r.mode === "new" ? (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-sun px-2.5 py-1 text-xs font-bold">
                      <AlertTriangle className="size-3.5" aria-hidden="true" /> No está en la página
                    </p>
                  ) : (
                    <p className="font-semibold">¿A qué producto corresponde?</p>
                  )}
                  {r.description ? (
                    <p className="mt-1 text-xs text-muted">
                      En la boleta: {r.code ? `${r.code} · ` : ""}
                      {r.description}
                      {r.kit ? ` (vino en ${r.kit})` : ""}
                    </p>
                  ) : null}
                  {r.mode === "existing" && r.match && r.unsure ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">¿Es este producto?</span>
                      <button
                        type="button"
                        onClick={() => update(r.key, { unsure: false })}
                        className="rounded-full bg-forest px-3 py-1.5 text-sm font-bold text-white"
                      >
                        Sí, es este
                      </button>
                      <button
                        type="button"
                        onClick={() => update(r.key, { unsure: false, match: null })}
                        className="rounded-full border-2 border-forest px-3 py-1 text-sm font-bold"
                      >
                        No
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-coral-soft hover:text-coral-deep"
                  aria-label="Quitar de la lista"
                >
                  <Trash2 className="size-5" aria-hidden="true" />
                </button>
              </div>

              {r.mode === "new" ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="rounded-2xl bg-cream p-3">
                    <p className="text-sm font-semibold">¿Ya está en la página con otro nombre? Buscalo y tocalo:</p>
                    <div className="mt-2">
                      <ProductPicker placeholder="Buscá (ej.: pitanga)" onPick={(p) => linkTo(r.key, p)} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold">Si no está, se crea como producto nuevo:</p>
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                    <label className="text-sm font-semibold">
                      Nombre del producto nuevo
                      <input
                        value={r.newName}
                        onChange={(e) => update(r.key, { newName: e.target.value })}
                        maxLength={120}
                        className={`${inputClasses} mt-1 h-11`}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Precio de revista
                      <input
                        value={r.newPrice}
                        onChange={(e) => update(r.key, { newPrice: e.target.value })}
                        inputMode="decimal"
                        placeholder="Ej.: 25000"
                        className={`${inputClasses} mt-1 h-11`}
                      />
                    </label>
                    {Number.isFinite(parseMoney(r.newPrice)) && parseMoney(r.newPrice) > 0 ? (
                      <p className="text-xs text-muted sm:col-span-2">Se va a vender a {formatARS(Math.round(parseMoney(r.newPrice) * 100))}.</p>
                    ) : null}
                  </div>
                </div>
              ) : !r.match ? (
                <div className="mt-3">
                  <ProductPicker placeholder="Buscá el producto (ej.: kaiak)" onPick={(p) => linkTo(r.key, p)} />
                  <button
                    type="button"
                    onClick={() => update(r.key, { mode: "new" })}
                    className="mt-2 text-sm font-bold text-coral-deep underline"
                  >
                    Mejor crearlo como producto nuevo
                  </button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Llegaron:</span>
                <Stepper value={r.quantity} onChange={(n) => update(r.key, { quantity: n })} />
              </div>
              <button
                type="button"
                onClick={() => void confirmOne(r)}
                disabled={busyKey !== null || saving}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-botanical-deep bg-sage font-bold text-botanical-deep hover:bg-botanical-deep hover:text-white disabled:opacity-50"
              >
                {busyKey === r.key ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                Cargar este ({r.quantity})
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-3xl bg-warm-white p-4 shadow-soft">
          <p className="font-semibold">¿Llegó algo que no está en la lista?</p>
          <div className="mt-2">
            <ProductPicker placeholder="Buscá y agregalo (ej.: ekos)" onPick={addMissing} />
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-1 size-5 accent-forest" />
          <span>
            <span className="font-semibold">Mostrar en la tienda los productos que estaban ocultos</span>
            <span className="block text-sm text-muted">Los productos nuevos quedan ocultos hasta que les pongas foto.</span>
          </span>
        </label>

        <div className="sticky bottom-0 z-10 -mx-1 flex gap-2 rounded-t-3xl bg-cream/95 p-2 backdrop-blur">
          <button
            type="button"
            onClick={confirm}
            disabled={saving || busyKey !== null || rows.length === 0}
            className={buttonClasses("primary", "lg", "flex-1")}
          >
            {saving ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-5" aria-hidden="true" />}
            Cargar todos ({units}<span className="hidden sm:inline">&nbsp;{units === 1 ? "unidad" : "unidades"}</span>)
          </button>
          <button
            type="button"
            onClick={() => (applied.units > 0 ? (setDone(applied), setRows(null)) : restart())}
            disabled={saving || busyKey !== null}
            className={buttonClasses("outline", "lg")}
          >
            {applied.units > 0 ? "Dejar el resto" : "Cancelar"}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ Fotos ------------------------------ */
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-warm-white p-5 shadow-soft">
        <h2 className="font-display text-xl font-bold">Cargar stock con la factura de Natura</h2>
        <ol className="mt-2 list-decimal pl-5 text-muted">
          <li>Subí el PDF de la factura (la «Nota Fiscal») o sacale fotos (si es larga, hasta {MAX_PHOTOS}).</li>
          <li>Revisá la lista que armamos y corregí lo que haga falta.</li>
          <li>Confirmá y se suma todo al stock.</li>
        </ol>
        <p className="mt-2 text-sm text-muted">
          Consejo: si tenés el PDF, usalo, que se lee mejor. Si sacás foto: con buena luz, la boleta derecha y que se vean bien las
          cantidades.
        </p>

        {photos.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <li key={p.url} className="relative">
                {p.pdfName ? (
                  <span className="flex h-32 w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-white p-2 text-center">
                    <FileText className="size-8 text-coral-deep" aria-hidden="true" />
                    <span className="line-clamp-3 text-[10px] break-all text-muted">{p.pdfName}</span>
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element -- vista previa local */
                  <img src={p.url} alt={`Foto ${i + 1} de la boleta`} className="h-32 w-24 rounded-2xl border border-line object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  disabled={reading}
                  className="absolute -top-2 -right-2 inline-flex size-8 items-center justify-center rounded-full bg-forest text-white"
                  aria-label={`Quitar foto ${i + 1}`}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {photos.length < MAX_PHOTOS && !reading ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <label className={buttonClasses(photos.length ? "outline" : "primary", "lg", "cursor-pointer")}>
              <FileText className="size-5" aria-hidden="true" /> Subir el PDF
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => {
                  void addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <label className={buttonClasses("outline", "lg", "cursor-pointer")}>
              <Camera className="size-5" aria-hidden="true" /> {photos.length ? "Sacar otra foto" : "Sacar foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  void addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <label className={buttonClasses("outline", "lg", "cursor-pointer")}>
              <ImagePlus className="size-5" aria-hidden="true" /> Elegir de la galería
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        ) : null}
        {preparing ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparando el archivo…
          </p>
        ) : null}
      </div>

      {photos.length > 0 ? (
        <button type="button" onClick={read} disabled={reading || preparing} className={buttonClasses("primary", "lg")}>
          {reading ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Leyendo la factura… (puede tardar hasta un minuto)
            </>
          ) : (
            "Leer la factura"
          )}
        </button>
      ) : null}
    </div>
  );
}
