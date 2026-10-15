// Generado con: npx supabase gen types typescript --local (no editar a mano)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_users": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_visible": boolean,"name": string,"position": number,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_visible"?: boolean,"name": string,"position"?: number,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_visible"?: boolean,"name"?: string,"position"?: number,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"order_lot_allocations": {
                  Row: {
                    "expires_on": string,"id": string,"order_id": string,"product_id": string,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_on": string,"id"?: string,"order_id": string,"product_id": string,"quantity": number
                  }
                  Update: {
                    "expires_on"?: string,"id"?: string,"order_id"?: string,"product_id"?: string,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_lot_allocations_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },
                    {
      foreignKeyName: "order_lot_allocations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"magazine_price": number,"name": string,"order_id": string,"product_id": string | null,"quantity": number,"size": string | null,"stock_taken": number | null,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"magazine_price": number,"name": string,"order_id": string,"product_id"?: string | null,"quantity": number,"size"?: string | null,"unit_price": number
                  }
                  Update: {
                    "id"?: string,"magazine_price"?: number,"name"?: string,"order_id"?: string,"product_id"?: string | null,"quantity"?: number,"size"?: string | null,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },
                    {
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount_paid": number,"channel": string,"code": string,"created_at": string,"customer_cancelled_at": string | null,"customer_name": string | null,"customer_phone": string | null,"gift_note": string | null,"id": string,"is_gift": boolean,"mp_payment_id": string | null,"number": number,"paid_at": string | null,"payment_method": string,"payment_note": string | null,"payment_proof_path": string | null,"payment_rejection": string | null,"payment_reported_at": string | null,"payment_status": string | null,"savings": number,"status": string,"stock_applied": boolean,"total": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paid"?: number,"channel"?: string,"code"?: string,"created_at"?: string,"customer_cancelled_at"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"gift_note"?: string | null,"id"?: string,"is_gift"?: boolean,"mp_payment_id"?: string | null,"number"?: never,"paid_at"?: string | null,"payment_method"?: string,"payment_note"?: string | null,"payment_proof_path"?: string | null,"payment_rejection"?: string | null,"payment_reported_at"?: string | null,"payment_status"?: string | null,"savings"?: number,"status"?: string,"stock_applied"?: boolean,"total": number,"updated_at"?: string
                  }
                  Update: {
                    "amount_paid"?: number,"channel"?: string,"code"?: string,"created_at"?: string,"customer_cancelled_at"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"gift_note"?: string | null,"id"?: string,"is_gift"?: boolean,"mp_payment_id"?: string | null,"number"?: never,"paid_at"?: string | null,"payment_method"?: string,"payment_note"?: string | null,"payment_proof_path"?: string | null,"payment_rejection"?: string | null,"payment_reported_at"?: string | null,"payment_status"?: string | null,"savings"?: number,"status"?: string,"stock_applied"?: boolean,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"receipt_aliases": {
                  Row: {
                    "description": string,"product_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"product_id": string,"updated_at"?: string
                  }
                  Update: {
                    "description"?: string,"product_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipt_aliases_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"receipt_items": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"product_id": string | null,"product_name": string,"quantity": number,"receipt_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"product_id"?: string | null,"product_name": string,"quantity": number,"receipt_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"product_id"?: string | null,"product_name"?: string,"quantity"?: number,"receipt_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipt_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },
                    {
      foreignKeyName: "receipt_items_receipt_id_fkey"
      columns: ["receipt_id"]
isOneToOne: false
      referencedRelation: "receipts"
      referencedColumns: ["id"]
    }
                  ]
                },"receipts": {
                  Row: {
                    "created_at": string,"due_date": string | null,"id": string,"invoice_date": string | null,"invoice_number": string | null,"total": number | null,"units": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"due_date"?: string | null,"id"?: string,"invoice_date"?: string | null,"invoice_number"?: string | null,"total"?: number | null,"units"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"due_date"?: string | null,"id"?: string,"invoice_date"?: string | null,"invoice_number"?: string | null,"total"?: number | null,"units"?: number,"updated_at"?: string
                  }
                  Relationships: [
                  ]
                },"campaigns": {
                  Row: {
                    "created_at": string,"ends_on": string,"id": string,"message": string | null,"product_ids": string[],"slug": string,"starts_on": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on": string,"id"?: string,"message"?: string | null,"product_ids"?: string[],"slug": string,"starts_on": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string,"id"?: string,"message"?: string | null,"product_ids"?: string[],"slug"?: string,"starts_on"?: string,"title"?: string
                  }
                  Relationships: [
                  ]
                },"loyalty_gifts": {
                  Row: {
                    "given_at": string,"id": string,"phone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "given_at"?: string,"id"?: string,"phone": string
                  }
                  Update: {
                    "given_at"?: string,"id"?: string,"phone"?: string
                  }
                  Relationships: [
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"p256dh": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"p256dh": string,"user_id"?: string | null
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"p256dh"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                  ]
                },"restock_requests": {
                  Row: {
                    "created_at": string,"id": string,"name": string | null,"notified_at": string | null,"phone": string,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name"?: string | null,"notified_at"?: string | null,"phone": string,"product_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string | null,"notified_at"?: string | null,"phone"?: string,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restock_requests_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"store_settings": {
                  Row: {
                    "facebook_url": string | null,"id": number,"instagram_url": string | null,"mp_link": string | null,"mp_surcharge_percent": number,"transfer_alias": string | null,"transfer_bank": string | null,"transfer_cbu": string | null,"transfer_holder": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "facebook_url"?: string | null,"id"?: number,"instagram_url"?: string | null,"mp_link"?: string | null,"mp_surcharge_percent"?: number,"transfer_alias"?: string | null,"transfer_bank"?: string | null,"transfer_cbu"?: string | null,"transfer_holder"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "facebook_url"?: string | null,"id"?: number,"instagram_url"?: string | null,"mp_link"?: string | null,"mp_surcharge_percent"?: number,"transfer_alias"?: string | null,"transfer_bank"?: string | null,"transfer_cbu"?: string | null,"transfer_holder"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_lots": {
                  Row: {
                    "created_at": string,"expires_on": string,"id": string,"product_id": string,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_on": string,"id"?: string,"product_id": string,"quantity": number
                  }
                  Update: {
                    "created_at"?: string,"expires_on"?: string,"id"?: string,"product_id"?: string,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_lots_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "alt": string | null,"created_at": string,"id": string,"position": number,"product_id": string,"source_url": string | null,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"created_at"?: string,"id"?: string,"position"?: number,"product_id": string,"source_url"?: string | null,"storage_path": string
                  }
                  Update: {
                    "alt"?: string | null,"created_at"?: string,"id"?: string,"position"?: number,"product_id"?: string,"source_url"?: string | null,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category_id": string | null,"created_at": string,"description": string,"discount_percent": number | null,"id": string,"in_stock": boolean | null,"is_featured": boolean,"is_offer": boolean,"is_refill": boolean | null,"line": string | null,"magazine_price": number,"name": string,"natura_sku": string | null,"sale_price": number,"size": string | null,"slug": string,"status": string,"stock": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"description"?: string,"discount_percent"?: never,"id"?: string,"in_stock"?: never,"is_featured"?: boolean,"is_offer"?: boolean,"is_refill"?: never,"line"?: string | null,"magazine_price": number,"name": string,"natura_sku"?: string | null,"sale_price": number,"size"?: string | null,"slug": string,"status"?: string,"stock"?: number,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"description"?: string,"discount_percent"?: never,"id"?: string,"in_stock"?: never,"is_featured"?: boolean,"is_offer"?: boolean,"is_refill"?: never,"line"?: string | null,"magazine_price"?: number,"name"?: string,"natura_sku"?: string | null,"sale_price"?: number,"size"?: string | null,"slug"?: string,"status"?: string,"stock"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "best_sellers":
{ Args: { "max_items"?: number }; Returns: { "product_id": string; "units": number }[]
                           },
            "create_order":
{ Args: { "customer_name"?: string; "items": Json }; Returns: { "id": string; "number": number; "total": number }[]
                           },
            "is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
            "rate_limit_hit":
{ Args: { "p_key": string; "p_max": number; "p_seconds": number }; Returns: boolean
                           },
            "set_order_status":
{ Args: { "new_status": string; "order_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
