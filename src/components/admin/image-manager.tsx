"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Link2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addProductImage,
  addProductImageFromUrl,
  deleteProductImage,
  reorderProductImages,
  replaceProductImage,
} from "@/app/admin/actions";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/config";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_PRODUCT,
  productImageUrl,
  validateImageFile,
  type AllowedImageType,
} from "@/lib/images";
import { getBrowserClient } from "@/lib/supabase/browser";
import { inputClasses } from "@/components/ui/fields";
import { ConfirmDialog } from "./confirm-dialog";

type Img = { id: string; storage_path: string; alt: string | null; position: number };

const ACCEPT = Object.keys(ALLOWED_IMAGE_TYPES).join(",");

/** Reduce fotos grandes en el navegador para que carguen rápido (máx. 1600 px, WebP). */
async function optimize(file: File): Promise<File> {
  if (file.type === "image/avif" || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Comprueba que el archivo realmente sea una imagen que el navegador puede mostrar. */
async function isDecodable(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img.naturalWidth > 0 && img.naturalHeight > 0;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Sube una foto de producto (achicada) y devuelve la ruta guardada. */
export async function uploadProductPhoto(productId: string, original: File): Promise<string> {
  const problem = validateImageFile(original);
  if (problem) throw new Error(problem);
  if (!(await isDecodable(original))) throw new Error("El archivo no es una imagen válida o está dañado.");
  const file = await optimize(original);
  const supabase = getBrowserClient();
  if (!supabase) throw new Error("El panel no está conectado a las fotos. Avisale a quien armó la página.");
  const ext = ALLOWED_IMAGE_TYPES[file.type as AllowedImageType];
  const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error("No pudimos subir la foto. Revisá tu conexión e intentá de nuevo.");
  return path;
}

export function ImageManager({ productId, images, productName }: { productId: string; images: Img[]; productName: string }) {
  const router = useRouter();
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Img | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [pending, start] = useTransition();
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const full = sorted.length >= MAX_IMAGES_PER_PRODUCT;

  async function onAdd(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const room = MAX_IMAGES_PER_PRODUCT - sorted.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast.warning(`Solo se agregan ${room} fotos más (máximo ${MAX_IMAGES_PER_PRODUCT}).`);
    let added = 0;
    for (const file of list) {
      try {
        const path = await uploadProductPhoto(productId, file);
        const res = await addProductImage(productId, path, productName);
        if (!res.ok) throw new Error(res.error);
        added++;
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      }
    }
    if (added) toast.success(added === 1 ? "Foto agregada." : `${added} fotos agregadas.`);
    setBusy(false);
    if (addRef.current) addRef.current.value = "";
    router.refresh();
  }

  async function onAddLink() {
    const url = link.trim();
    if (!url) return;
    setBusy(true);
    try {
      const res = await addProductImageFromUrl(productId, url);
      if (!res.ok) throw new Error(res.error);
      toast.success("Foto agregada.");
      setLink("");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
    router.refresh();
  }

  async function onReplace(files: FileList | null) {
    const file = files?.[0];
    const imageId = replacing;
    if (replaceRef.current) replaceRef.current.value = "";
    if (!file || !imageId) return;
    setBusy(true);
    try {
      const path = await uploadProductPhoto(productId, file);
      const res = await replaceProductImage(imageId, path);
      if (!res.ok) throw new Error(res.error);
      toast.success("Foto reemplazada.");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setReplacing(null);
    setBusy(false);
    router.refresh();
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...sorted];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    start(async () => {
      const res = await reorderProductImages(productId, next.map((i) => i.id));
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  const disabled = busy || pending;

  return (
    <section className="rounded-3xl bg-warm-white p-5 shadow-soft" aria-labelledby="fotos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="fotos" className="font-display text-xl font-bold">Fotos</h2>
          <p className="text-sm text-muted">
            JPG, PNG, WebP o AVIF de hasta 5 MB. La primera es la principal. ({sorted.length}/{MAX_IMAGES_PER_PRODUCT})
          </p>
        </div>
        <label
          className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-botanical-deep px-5 font-semibold text-white shadow-soft hover:bg-[#146347] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-botanical ${disabled || full ? "pointer-events-none opacity-55" : ""}`}
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
          {busy ? "Subiendo…" : "Agregar fotos"}
          <input
            ref={addRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            disabled={disabled || full}
            onChange={(e) => onAdd(e.target.files)}
          />
        </label>
        <input
          ref={replaceRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onReplace(e.target.files)}
        />
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void onAddLink();
        }}
      >
        <label className="sr-only" htmlFor={`foto-enlace-${productId}`}>Enlace de una foto</label>
        <input
          id={`foto-enlace-${productId}`}
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="O pegá el enlace de una foto (de cualquier página)"
          autoComplete="off"
          disabled={disabled || full}
          className={`${inputClasses} h-11 min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={disabled || full || !link.trim()}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-warm-white px-5 font-semibold shadow-soft ring-1 ring-line hover:bg-cream disabled:pointer-events-none disabled:opacity-55"
        >
          <Link2 className="size-5" aria-hidden="true" /> Traer foto
        </button>
      </form>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Todavía no hay fotos. Las fotos grandes y con buena luz venden más.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((img, i) => {
            const src = productImageUrl(img.storage_path);
            return (
              <li key={img.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                <div className="relative aspect-square">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={`Foto ${i + 1} de ${productName}`} className="size-full object-cover" />
                  ) : null}
                  {i === 0 ? (
                    <span className="absolute top-2 left-2 rounded-full bg-forest/80 px-2 py-0.5 text-xs font-bold text-white">Principal</span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <div className="flex">
                    <button type="button" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-forest/5 disabled:opacity-30" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Mover antes">
                      <ArrowLeft className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-forest/5 disabled:opacity-30" disabled={disabled || i === sorted.length - 1} onClick={() => move(i, 1)} aria-label="Mover después">
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex">
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-full hover:bg-forest/5"
                      disabled={disabled}
                      onClick={() => {
                        setReplacing(img.id);
                        replaceRef.current?.click();
                      }}
                      aria-label={`Reemplazar foto ${i + 1}`}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="inline-flex size-9 items-center justify-center rounded-full text-coral-deep hover:bg-coral-soft" disabled={disabled} onClick={() => setToDelete(img)} aria-label={`Eliminar foto ${i + 1}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="¿Eliminar esta foto?"
        description="La foto se borra para siempre."
        pending={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          start(async () => {
            if (!toDelete) return;
            const res = await deleteProductImage(toDelete.id);
            setToDelete(null);
            if (res.ok) toast.success("Foto eliminada.");
            else toast.error(res.error);
            router.refresh();
          })
        }
      />
    </section>
  );
}
