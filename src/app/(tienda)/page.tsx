import { HomeView } from "@/components/store/home-view";
import {
  getActiveCampaign,
  getActiveCategories,
  getBestSellers,
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

export default async function HomePage() {
  const [count, categories, highlights, bestSellers, campaign, reviews] = await Promise.all([
    getPublishedCount(),
    getActiveCategories(),
    getHighlights(8),
    getBestSellers(8),
    getActiveCampaign(),
    getReviewSummary(),
  ]);
  const clubMin = await getLoyaltyMinTotal();
  const campaignProducts = campaign ? await getProductsByIds(campaign.productIds) : [];
  const whatsapp = getWhatsAppNumber();

  return (
    <HomeView
      d={{
        hasProducts: (count ?? 0) > 0,
        categories,
        offers: highlights.offers,
        bestSellers,
        featured: highlights.featured,
        latest: highlights.latest,
        heroProducts: pickHeroProducts(highlights.offers, highlights.featured, bestSellers, highlights.latest),
        campaign: campaign ? { ...campaign, products: campaignProducts } : null,
        clubMinCents: Math.round(clubMin * 100),
        reviews,
        whatsappUrl: whatsapp ? buildWhatsAppUrl(whatsapp, "¡Hola Mariel! Quería hacerte una consulta 😊") : null,
      }}
    />
  );
}
