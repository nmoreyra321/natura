/**
 * Tipos de filas usados por la app. El tipo Database completo se genera desde el esquema:
 *   npx supabase gen types typescript --local > src/lib/supabase/database.generated.ts
 */

export type ProductStatus = "draft" | "published";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category_id: string | null;
  size: string | null;
  magazine_price: number;
  sale_price: number;
  stock: number;
  status: ProductStatus;
  is_featured: boolean;
  is_offer: boolean;
  /** Código del producto en naturacosmeticos.com.ar (por ejemplo NATARG-2821). */
  natura_sku: string | null;
  /** Columna generada por la base: solo lectura. */
  discount_percent: number;
  created_at: string;
  updated_at: string;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  storage_path: string;
  alt: string | null;
  position: number;
  created_at: string;
};

export type AdminUserRow = {
  user_id: string;
  created_at: string;
};

export type { Database } from "./database.generated";
