import {
  BellRing,
  CalendarClock,
  CalendarHeart,
  CirclePlus,
  ExternalLink,
  Gift,
  ImageIcon,
  LogOut,
  MessageSquareHeart,
  PackagePlus,
  Settings,
  ShoppingBasket,
  Tags,
} from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Menú" };

const GROUPS = [
  {
    title: "Vender",
    links: [
      { href: "/admin/vender", label: "Anotar una venta", hint: "Venta rápida, por fuera de la tienda", icon: CirclePlus },
      { href: "/admin/club", label: "Club de clientas", hint: "Compras y regalos", icon: Gift },
      { href: "/admin/fechas", label: "Fechas especiales", hint: "Día de la Madre, del Padre…", icon: CalendarHeart },
      { href: "/admin/resenas", label: "Reseñas", hint: "Lo que dicen las clientas", icon: MessageSquareHeart },
    ],
  },
  {
    title: "Mercadería",
    links: [
      { href: "/admin/productos?vista=llego", label: "Cargar caja de Natura", hint: "Con la foto de la factura o a mano", icon: PackagePlus },
      { href: "/admin/categorias", label: "Categorías", hint: "Cómo se ordenan los productos", icon: Tags },
      { href: "/admin/precios", label: "Precios y fotos de Natura", hint: "Actualizar desde Natura", icon: ImageIcon },
      { href: "/admin/reponer", label: "Qué le pido a Natura", hint: "Lo que se está acabando", icon: ShoppingBasket },
      { href: "/admin/vencimientos", label: "Productos por vencer", hint: "Para ofrecer primero", icon: CalendarClock },
      { href: "/admin/avisos", label: "Clientas esperando un producto", hint: "Avisales cuando vuelva", icon: BellRing },
    ],
  },
  {
    title: "Ajustes",
    links: [{ href: "/admin/configuracion", label: "Ajustes", hint: "Alias, envíos, redes, recargo y avisos al celular", icon: Settings }],
  },
] as const;

export default async function MorePage() {
  const { user } = await requireAdmin();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl font-bold">Menú</h1>
      {GROUPS.map((g) => (
        <section key={g.title} className="mt-5" aria-label={g.title}>
          <h2 className="mb-2 text-xs font-extrabold tracking-wide text-botanical-deep uppercase">{g.title}</h2>
          <ul className="flex flex-col gap-2">
            {g.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center gap-3 rounded-2xl border-2 border-line bg-warm-white p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sage text-botanical-deep">
                    <l.icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-lg leading-tight font-extrabold">
                    {l.label}
                    <span className="block text-sm font-semibold text-muted">{l.hint}</span>
                  </span>
                  <span aria-hidden="true" className="text-2xl text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ul className="mt-5 flex flex-col gap-2">
        <li>
          <Link href="/" target="_blank" className="flex items-center gap-3 rounded-2xl border-2 border-line bg-warm-white p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lilac text-grape">
              <ExternalLink className="size-6" aria-hidden="true" />
            </span>
            <span className="flex-1 text-lg font-extrabold">Ver la tienda</span>
          </Link>
        </li>
      </ul>
      <div className="mt-6 border-t border-line pt-4">
        {user.email ? <p className="truncate text-sm text-muted">{user.email}</p> : null}
        <form action={signOut} className="mt-2">
          <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full px-3 font-semibold hover:bg-forest/5">
            <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
