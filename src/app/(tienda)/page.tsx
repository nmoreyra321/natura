import { HomeView } from "@/components/store/home-view";
import {
  getActiveCampaign,
  getActiveCategories,
  getBestSellers,
  getCatalog,
  getHighlights,
  getProductsByIds,
  getPublishedCount,
  getReviewSummary,
  type PublicProduct,
} from "@/lib/catalog";
import { getLoyaltyMinTotal } from "@/lib/store-settings";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export const revalidate = 300;

/** Hasta 3 productos distintos con foto y stock para la portada (ofertas primero). */
function pickHeroProducts(...lists: PublicProduct[][]): PublicProduct[] {
  const seen = new Set<string>();
  const out: PublicProduct[] = [];
  for (const p of lists.flat()) {
    if (out.length === 3) break;
    if (seen.has(p.id) || p.images.length === 0 || p.stock <= 0) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/** Primero lo que hay en stock (lo agotado igual se muestra, al final). */
function stockFirst(list: PublicProduct[]): PublicProduct[] {
  return [...list.filter((p) => p.stock > 0), ...list.filter((p) => p.stock <= 0)];
}

/** Hasta 8 productos para «Todos los productos» que no estén ya en las otras filas del inicio. */
function pickMore(all: PublicProduct[], ...shown: PublicProduct[][]): PublicProduct[] {
  const seen = new Set(shown.flatMap((list) => list.slice(0, 8).map((p) => p.id)));
  const fresh = all.filter((p) => !seen.has(p.id));
  return (fresh.length >= 4 ? fresh : all).slice(0, 8);
}

export default async function HomePage() {
  const [count, categories, highlights, bestSellers, campaign, reviews, catalog] = await Promise.all([
    getPublishedCount(),
    getActiveCategories(),
    getHighlights(8),
    getBestSellers(8),
    getActiveCampaign(),
    getReviewSummary(),
    getCatalog({ sort: "destacados", page: 1 }),
  ]);
  const clubMin = await getLoyaltyMinTotal();
  const campaignProducts = campaign ? await getProductsByIds(campaign.productIds) : [];
  const whatsapp = getWhatsAppNumber();

  return (
    <HomeView
      d={{
        hasProducts: (count ?? 0) > 0,
        categories,
        offers: stockFirst(highlights.offers),
        bestSellers,
        featured: stockFirst(highlights.featured),
        latest: stockFirst(highlights.latest),
        heroProducts: pickHeroProducts(highlights.offers, highlights.featured, bestSellers, highlights.latest),
        campaign: campaign ? { ...campaign, products: campaignProducts } : null,
        clubMinCents: Math.round(clubMin * 100),
        reviews,
        // «Todos los productos» al final: los que no aparecieron en las filas de arriba.
        more: stockFirst(pickMore(catalog.products, highlights.offers, bestSellers, highlights.featured, highlights.latest)),
        totalProducts: catalog.total || count || 0,
        whatsappUrl: whatsapp ? buildWhatsAppUrl(whatsapp, "¡Hola Mariel! Quería hacerte una consulta 😊") : null,
      }}
    />
  );
}
