import { AlertTriangle, Eye, FileEdit, PackageX, Percent, Plus, Settings, Tags, TrendingDown } from "lucide-react";
import Link from "next/link";

import { LinkButton } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/config";
import { getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();
  const { data: products, error } = await supabase
    .from("products")
    .select("status, stock, is_offer, discount_percent");

  const list = products ?? [];
  const stats = [
    { label: "Publicados", value: list.filter((p) => p.status === "published").length, icon: Eye, href: "/admin/productos?estado=published", tone: "bg-sage text-botanical-deep" },
    { label: "Borradores", value: list.filter((p) => p.status === "draft").length, icon: FileEdit, href: "/admin/productos?estado=draft", tone: "bg-cream text-forest" },
    { label: "Sin stock", value: list.filter((p) => p.stock === 0).length, icon: PackageX, href: "/admin/productos?stock=sin", tone: "bg-coral-soft text-coral-deep" },
    { label: `Stock bajo (≤ ${LOW_STOCK_THRESHOLD})`, value: list.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length, icon: TrendingDown, href: "/admin/productos?stock=bajo", tone: "bg-blush text-coral-deep" },
    { label: "En oferta", value: list.filter((p) => p.is_offer && Number(p.discount_percent) > 0).length, icon: Percent, href: "/admin/productos?oferta=1", tone: "bg-pink text-forest" },
  ];
  const whatsapp = getWhatsAppNumber();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">¡Hola, Mariel!</h1>
          <p className="text-muted">Así está tu tienda hoy.</p>
        </div>
        <LinkButton href="/admin/productos/nuevo" size="lg">
          <Plus className="size-5" aria-hidden="true" /> Nuevo producto
        </LinkButton>
      </div>

      {!whatsapp ? (
        <div className="mt-6 flex gap-3 rounded-3xl border border-coral/40 bg-coral-soft p-4" role="status">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral-deep" aria-hidden="true" />
          <div>
            <p className="font-semibold">Falta configurar el número de WhatsApp.</p>
            <p className="text-sm">
              Mientras tanto, los clientes pueden armar el carrito pero no enviar pedidos.{" "}
              <Link href="/admin/configuracion" className="font-semibold underline">Ver cómo configurarlo</Link>
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar las estadísticas.</p>
      ) : null}

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="flex h-full flex-col gap-3 rounded-3xl bg-warm-white p-4 shadow-soft transition-shadow hover:shadow-lift">
              <span className={`flex size-10 items-center justify-center rounded-full ${s.tone}`}>
                <s.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-3xl font-extrabold tabular">{s.value}</span>
              <span className="text-sm font-semibold text-muted">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {list.length === 0 && !error ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line bg-warm-white p-8 text-center">
          <p className="font-display text-xl font-bold">Todavía no cargaste productos.</p>
          <p className="mt-1 text-muted">Creá el primero: cuando lo publiques, va a aparecer en la tienda.</p>
          <LinkButton href="/admin/productos/nuevo" className="mt-5">
            <Plus className="size-5" aria-hidden="true" /> Cargar mi primer producto
          </LinkButton>
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/categorias" className="flex items-center gap-3 rounded-3xl bg-warm-white p-5 shadow-soft hover:shadow-lift">
          <Tags className="size-6 text-botanical" aria-hidden="true" />
          <span>
            <span className="block font-semibold">Categorías</span>
            <span className="text-sm text-muted">Ordená y editá las secciones de la tienda</span>
          </span>
        </Link>
        <Link href="/admin/configuracion" className="flex items-center gap-3 rounded-3xl bg-warm-white p-5 shadow-soft hover:shadow-lift">
          <Settings className="size-6 text-botanical" aria-hidden="true" />
          <span>
            <span className="block font-semibold">Configuración</span>
            <span className="text-sm text-muted">WhatsApp y estado de la tienda</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
