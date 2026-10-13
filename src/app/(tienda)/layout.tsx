import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { getActiveCategories } from "@/lib/catalog";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await getActiveCategories();
  const nav = categories.map((c) => ({ name: c.name, slug: c.slug }));
  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-forest px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <Header categories={nav} />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Footer categories={nav} />
    </>
  );
}
