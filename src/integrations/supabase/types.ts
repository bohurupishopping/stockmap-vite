export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      mr_stock_summary: {
        Row: {
          batch_id: string
          current_quantity_strips: number
          last_updated_at: string
          mr_user_id: string
          product_id: string
        }
        Insert: {
          batch_id: string
          current_quantity_strips?: number
          last_updated_at?: string
          mr_user_id: string
          product_id: string
        }
        Update: {
          batch_id?: string
          current_quantity_strips?: number
          last_updated_at?: string
          mr_user_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mr_stock_summary_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mr_stock_summary_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_cost_per_strip: number | null
          batch_number: string
          created_at: string
          expiry_date: string
          id: string
          manufacturing_date: string
          notes: string | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          batch_cost_per_strip?: number | null
          batch_number: string
          created_at?: string
          expiry_date: string
          id?: string
          manufacturing_date: string
          notes?: string | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          batch_cost_per_strip?: number | null
          batch_number?: string
          created_at?: string
          expiry_date?: string
          id?: string
          manufacturing_date?: string
          notes?: string | null
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_name: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_formulations: {
        Row: {
          created_at: string
          formulation_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          formulation_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          formulation_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_packaging_units: {
        Row: {
          conversion_factor_to_strips: number
          created_at: string
          default_purchase_unit: boolean
          default_sales_unit_direct: boolean
          default_sales_unit_mr: boolean
          id: string
          is_base_unit: boolean
          order_in_hierarchy: number
          product_id: string
          unit_name: string
          updated_at: string
        }
        Insert: {
          conversion_factor_to_strips?: number
          created_at?: string
          default_purchase_unit?: boolean
          default_sales_unit_direct?: boolean
          default_sales_unit_mr?: boolean
          id?: string
          is_base_unit?: boolean
          order_in_hierarchy: number
          product_id: string
          unit_name: string
          updated_at?: string
        }
        Update: {
          conversion_factor_to_strips?: number
          created_at?: string
          default_purchase_unit?: boolean
          default_sales_unit_direct?: boolean
          default_sales_unit_mr?: boolean
          id?: string
          is_base_unit?: boolean
          order_in_hierarchy?: number
          product_id?: string
          unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packaging_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sub_categories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          sub_category_name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sub_category_name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sub_category_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_cost_per_strip: number
          category_id: string
          created_at: string
          formulation_id: string
          generic_name: string
          id: string
          image_url: string | null
          is_active: boolean
          lead_time_days: number | null
          manufacturer: string
          min_stock_level_godown: number | null
          min_stock_level_mr: number | null
          product_code: string
          product_name: string
          storage_conditions: string | null
          sub_category_id: string | null
          unit_of_measure_smallest: string
          updated_at: string
        }
        Insert: {
          base_cost_per_strip: number
          category_id: string
          created_at?: string
          formulation_id: string
          generic_name: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          lead_time_days?: number | null
          manufacturer: string
          min_stock_level_godown?: number | null
          min_stock_level_mr?: number | null
          product_code: string
          product_name: string
          storage_conditions?: string | null
          sub_category_id?: string | null
          unit_of_measure_smallest?: string
          updated_at?: string
        }
        Update: {
          base_cost_per_strip?: number
          category_id?: string
          created_at?: string
          formulation_id?: string
          generic_name?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          lead_time_days?: number | null
          manufacturer?: string
          min_stock_level_godown?: number | null
          min_stock_level_mr?: number | null
          product_code?: string
          product_name?: string
          storage_conditions?: string | null
          sub_category_id?: string | null
          unit_of_measure_smallest?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_formulation_id_fkey"
            columns: ["formulation_id"]
            isOneToOne: false
            referencedRelation: "product_formulations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "product_sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products_stock_status: {
        Row: {
          batch_id: string
          cost_per_strip: number
          created_at: string
          current_quantity_strips: number
          id: string
          last_updated_at: string
          location_id: string
          location_type: string
          product_id: string
          total_value: number | null
        }
        Insert: {
          batch_id: string
          cost_per_strip?: number
          created_at?: string
          current_quantity_strips?: number
          id?: string
          last_updated_at?: string
          location_id: string
          location_type: string
          product_id: string
          total_value?: number | null
        }
        Update: {
          batch_id?: string
          cost_per_strip?: number
          created_at?: string
          current_quantity_strips?: number
          id?: string
          last_updated_at?: string
          location_id?: string
          location_type?: string
          product_id?: string
          total_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_stock_status_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_stock_status_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_transactions: {
        Row: {
          batch_id: string
          cost_per_strip_at_transaction: number
          created_at: string
          created_by: string | null
          location_id_destination: string | null
          location_id_source: string | null
          location_type_destination: string | null
          location_type_source: string | null
          notes: string | null
          product_id: string
          quantity_strips: number
          reference_document_id: string | null
          reference_document_type: string | null
          transaction_date: string
          transaction_group_id: string
          transaction_id: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          cost_per_strip_at_transaction: number
          created_at?: string
          created_by?: string | null
          location_id_destination?: string | null
          location_id_source?: string | null
          location_type_destination?: string | null
          location_type_source?: string | null
          notes?: string | null
          product_id: string
          quantity_strips: number
          reference_document_id?: string | null
          reference_document_type?: string | null
          transaction_date?: string
          transaction_group_id: string
          transaction_id?: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          cost_per_strip_at_transaction?: number
          created_at?: string
          created_by?: string | null
          location_id_destination?: string | null
          location_id_source?: string | null
          location_type_destination?: string | null
          location_type_source?: string | null
          notes?: string | null
          product_id?: string
          quantity_strips?: number
          reference_document_id?: string | null
          reference_document_type?: string | null
          transaction_date?: string
          transaction_group_id?: string
          transaction_id?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          phone: string | null
          supplier_code: string | null
          supplier_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          supplier_code?: string | null
          supplier_name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          supplier_code?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      recalculate_products_stock_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "user"],
    },
  },
} as const
