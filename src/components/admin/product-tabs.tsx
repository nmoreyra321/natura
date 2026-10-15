import { List, PackagePlus, RefreshCw, Tags } from "lucide-react";
import Link from "next/link";

export type ProductTab = "lista" | "llego" | "categorias" | "natura";

const TABS: { key: ProductTab; href: string; label: string; icon: typeof List }[] = [
  { key: "llego", href: "/admin/productos?vista=llego", label: "Cargar caja de Natura", icon: PackagePlus },
  { key: "lista", href: "/admin/productos", label: "Stock", icon: List },
  { key: "categorias", href: "/admin/categorias", label: "Categorías", icon: Tags },
  { key: "natura", href: "/admin/precios", label: "Precios y fotos Natura", icon: RefreshCw },
];

/** Pestañas de la sección Productos (en el celular se deslizan de costado). */
export function ProductTabs({ active }: { active: ProductTab }) {
  return (
    <nav aria-label="Secciones de productos" className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1.5">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold whitespace-nowrap ${on ? "bg-forest text-white" : "bg-warm-white text-forest/80 shadow-soft hover:bg-sun"}`}
              >
                <t.icon className="size-4" aria-hidden="true" /> {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Encabezado común de la sección Productos: título, botón "Nuevo producto" y pestañas. */
export function ProductsHeader({ active, subtitle, action }: { active: ProductTab; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Productos</h1>
          {subtitle ? <p className="text-sm text-muted tabular">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <ProductTabs active={active} />
    </div>
  );
}
