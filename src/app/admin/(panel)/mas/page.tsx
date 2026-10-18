import { BellRing, CalendarClock, CalendarHeart, ExternalLink, Gift, LogOut, MessageSquareHeart, Settings, ShoppingBasket } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Más cosas" };

const LINKS = [
  { href: "/admin/reponer", label: "Qué le pido a Natura", hint: "Lo que se está acabando", icon: ShoppingBasket },
  { href: "/admin/vencimientos", label: "Productos por vencer", hint: "Para ofrecer primero", icon: CalendarClock },
  { href: "/admin/avisos", label: "Clientas esperando un producto", hint: "Avisales cuando vuelva", icon: BellRing },
  { href: "/admin/club", label: "Club de clientas", hint: "Compras y regalos", icon: Gift },
  { href: "/admin/fechas", label: "Fechas especiales", hint: "Día de la Madre, del Padre…", icon: CalendarHeart },
  { href: "/admin/resenas", label: "Reseñas", hint: "Lo que dicen las clientas", icon: MessageSquareHeart },
  { href: "/admin/configuracion", label: "Ajustes", hint: "Alias, envíos, redes", icon: Settings },
] as const;

export default async function MorePage() {
  const { user } = await requireAdmin();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl font-bold">Más cosas</h1>
      <ul className="mt-5 flex flex-col gap-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-4 rounded-2xl bg-warm-white p-4 shadow-soft">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sage text-botanical-deep">
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
        <li>
          <Link href="/" target="_blank" className="flex items-center gap-4 rounded-2xl bg-warm-white p-4 shadow-soft">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lilac text-grape">
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
