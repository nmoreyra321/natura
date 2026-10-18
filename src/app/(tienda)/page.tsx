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

/**
 * En la pantalla principal solo se muestra lo que hay en stock (para vender lo que tenemos).
 * Lo agotado sigue apareciendo en las categorías y en la búsqueda, al final.
 */
function inStock(list: PublicProduct[]): PublicProduct[] {
  return list.filter((p) => p.stock > 0);
}

/** Una fila con menos de esto queda rara (casi vacía), así que no se muestra. */
const MIN_ROW = 3;

/**
 * Reparte los productos entre las filas del inicio sin repetir ninguno: cada fila toma los que
 * todavía no salieron en las de arriba. Si le quedan muy pocos, la fila no se muestra.
 */
function makeTaker() {
  const used = new Set<string>();
  return (list: PublicProduct[], max = 8): PublicProduct[] => {
    const row = list.filter((p) => !used.has(p.id)).slice(0, max);
    if (row.length < MIN_ROW) return [];
    for (const p of row) used.add(p.id);
    return row;
  };
}

export default async function HomePage() {
  const [count, categories, highlights, bestSellers, campaign, reviews, catalog] = await Promise.all([
    getPublishedCount(),
    getActiveCategories(),
    getHighlights(8, { inStockOnly: true }),
    getBestSellers(16),
    getActiveCampaign(),
    getReviewSummary(),
    getCatalog({ sort: "destacados", page: 1 }),
  ]);
  const clubMin = await getLoyaltyMinTotal();
  const campaignProducts = campaign ? inStock(await getProductsByIds(campaign.productIds)) : [];
  const take = makeTaker();
  // De arriba hacia abajo, en el mismo orden en que se muestran en el inicio.
  const campaignRow = take(campaignProducts);
  const offers = take(highlights.offers);
  const sellers = take(inStock(bestSellers));
  const featured = take(highlights.featured);
  const latest = take(highlights.latest);
  const more = take(inStock(catalog.products));
  const whatsapp = getWhatsAppNumber();

  return (
    <HomeView
      d={{
        hasProducts: (count ?? 0) > 0,
        categories,
        offers,
        bestSellers: sellers,
        featured,
        latest,
        heroProducts: pickHeroProducts(highlights.offers, highlights.featured, sellers, highlights.latest),
        campaign: campaign ? { ...campaign, products: campaignRow } : null,
        clubMinCents: Math.round(clubMin * 100),
        reviews,
        // «Todos los productos» al final: los que no aparecieron en las filas de arriba.
        more,
        totalProducts: catalog.total || count || 0,
        whatsappUrl: whatsapp ? buildWhatsAppUrl(whatsapp, "¡Hola Mariel! Quería hacerte una consulta 😊") : null,
      }}
    />
  );
}
