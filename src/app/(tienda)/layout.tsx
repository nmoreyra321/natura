import { BackButton } from "@/components/store/back-button";
import { BottomNav } from "@/components/store/bottom-nav";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { Helper } from "@/components/store/helper";
import { WhatsAppFab } from "@/components/store/whatsapp-fab";
import { getActiveCategories } from "@/lib/catalog";
import { DELIVERY_TEXT } from "@/lib/delivery";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { isMercadoPagoEnabled } from "@/lib/mercadopago";
import { getShippingMinTotal } from "@/lib/shipping";
import { getLoyaltyMinTotal, getMercadoPagoSurcharge, getTransferDetails } from "@/lib/store-settings";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, transfer, shippingMin, clubMin, mpSurcharge] = await Promise.all([
    getActiveCategories(),
    getTransferDetails(),
    getShippingMinTotal(),
    getLoyaltyMinTotal(),
    isMercadoPagoEnabled() ? getMercadoPagoSurcharge() : 0,
  ]);
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
      <Helper
        whatsappNumber={whatsapp}
        info={{
          alias: transfer?.alias ?? null,
          mpSurcharge,
          shippingMin: shippingMin > 0 ? formatARS(Math.round(shippingMin * 100)) : null,
          clubMin: clubMin > 0 ? formatARS(Math.round(clubMin * 100)) : null,
          giftEvery: GIFT_EVERY,
          deliveryText: DELIVERY_TEXT,
        }}
      />
      {whatsapp ? <WhatsAppFab url={buildWhatsAppUrl(whatsapp, "¡Hola Mariel! Quería hacerte una consulta 😊")} /> : null}
    </>
  );
}
