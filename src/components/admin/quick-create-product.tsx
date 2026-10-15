"use client";

import { Camera, Loader2, PackagePlus, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { addProductImage, quickCreateProduct, updateProductQuick } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { uploadProductPhoto } from "./image-manager";

type Category = { id: string; name: string };

const field =
  "mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3 text-base focus:border-botanical focus:outline-none focus:ring-3 focus:ring-botanical/20";

/**
 * Crear un producto que todavía no está en la tienda, sin salir de la pantalla.
 * Con foto queda publicado; sin foto queda como borrador hasta que se le agregue.
 */
export function QuickCreateProduct({
  initialName,
  initialQuantity = 1,
  quantityLabel = "Cantidad que llegó",
  categories,
  onDone,
  onCancel,
}: {
  initialName: string;
  initialQuantity?: number;
  quantityLabel?: string;
  categories: Category[];
  onDone: (product: { id: string; name: string; quantity: number; published: boolean }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [magazine, setMagazine] = useState("");
  const [sale, setSale] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const qty = Number(quantity);
    const res = await quickCreateProduct({ name, magazinePrice: magazine, salePrice: sale, categoryId, stock: qty });
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "No pudimos crear el producto." : res.error);
      setSaving(false);
      return;
    }
    const product = res.data;
    let published = false;
    if (photo) {
      try {
        const path = await uploadProductPhoto(product.id, photo);
        const added = await addProductImage(product.id, path, product.name);
        if (!added.ok) throw new Error(added.error);
        const pub = await updateProductQuick(product.id, { status: "published" });
        published = pub.ok;
      } catch (e) {
        toast.error(`El producto se creó, pero la foto no se pudo subir: ${(e as Error).message}`);
      }
    }
    toast.success(
      published ? (
        `«${product.name}» creado y publicado en la tienda.`
      ) : (
        <span>
          «{product.name}» creado como borrador.{" "}
          <Link href={`/admin/productos/${product.id}`} className="font-bold underline">
            Agregale una foto para publicarlo
          </Link>
          .
        </span>
      ),
    );
    setSaving(false);
    onDone({ id: product.id, name: product.name, quantity: qty, published });
  };

  return (
    <form
      className="rounded-3xl border-2 border-dashed border-botanical/60 bg-sage/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <PackagePlus className="size-5 text-botanical-deep" aria-hidden="true" /> Producto nuevo
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex size-9 items-center justify-center rounded-full hover:bg-white"
          aria-label="Cancelar"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          Nombre (como lo van a ver las clientas)
          <input value={name} onChange={(e) => setName(e.target.value)} required className={field} />
        </label>
        <label className="text-sm font-semibold">
          Precio de revista
          <input value={magazine} onChange={(e) => setMagazine(e.target.value)} inputMode="decimal" placeholder="$ 20.000" required className={field} />
        </label>
        <label className="text-sm font-semibold">
          Tu precio <span className="font-normal text-muted">(si lo dejás vacío, el de revista)</span>
          <input value={sale} onChange={(e) => setSale(e.target.value)} inputMode="decimal" placeholder="$ 17.000" className={field} />
        </label>
        <label className="text-sm font-semibold">
          Categoría
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
            <option value="">Elegí una</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          {quantityLabel}
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" inputMode="numeric" min={0} className={field} />
        </label>
        <div className="sm:col-span-2">
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id="foto-nuevo"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          {photo ? (
            <p className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm">
              <Camera className="size-4 text-botanical-deep" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-semibold">{photo.name}</span>
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  if (photoRef.current) photoRef.current.value = "";
                }}
                className="text-coral-deep underline"
              >
                Quitar
              </button>
            </p>
          ) : (
            <label
              htmlFor="foto-nuevo"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white/70 px-3 py-3 text-sm font-bold hover:bg-white"
            >
              <Camera className="size-5 text-botanical-deep" aria-hidden="true" /> Sacar o elegir una foto
              <span className="font-normal text-muted">(para publicarlo)</span>
            </label>
          )}
        </div>
      </div>
      <button type="submit" disabled={saving} className={buttonClasses("primary", "md", "mt-4 w-full sm:w-auto")}>
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PackagePlus className="size-4" aria-hidden="true" />}
        {photo ? "Crear y publicar" : "Crear (borrador, sin foto)"}
      </button>
    </form>
  );
}
