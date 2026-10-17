import { BackButton } from "@/components/store/back-button";
import { BottomNav } from "@/components/store/bottom-nav";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { WhatsAppFab } from "@/components/store/whatsapp-fab";
import { getActiveCategories } from "@/lib/catalog";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await getActiveCategories();
  const nav = categories.map((c) => ({ name: c.name, slug: c.slug }));
  const whatsapp = getWhatsAppNumber();
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
        <BackButton />
        {children}
      </main>
      <Footer categories={nav} />
      <BottomNav />
      {whatsapp ? <WhatsAppFab url={buildWhatsAppUrl(whatsapp, "¡Hola Mariel! Quería hacerte una consulta 😊")} /> : null}
    </>
  );
}
