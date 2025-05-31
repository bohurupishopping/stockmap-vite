export interface StockItem {
  product_id: string;
  product_name: string;
  product_code: string;
  generic_name: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  location_type: string;
  location_id: string;
  current_quantity_strips: number;
  cost_per_strip: number;
  total_value: number;
  category_name?: string;
  min_stock_level_godown?: number;
  min_stock_level_mr?: number;
}

export interface StockSummary {
  total_products: number;
  total_batches: number;
  total_value: number;
  low_stock_items: number;
  expiring_soon_items: number;
}

export interface Product {
  id: string;
  product_name: string;
  product_code: string;
  generic_name: string;
  min_stock_level_godown?: number;
  min_stock_level_mr?: number;
  product_categories: any;
}

export interface Batch {
  id: string;
  batch_number: string;
  expiry_date: string;
}

export interface Transaction {
  product_id: string;
  batch_id: string;
  transaction_type: string;
  quantity_strips: number;
  location_type_source: string;
  location_id_source: string;
  location_type_destination: string;
  location_id_destination: string;
  cost_per_strip_at_transaction: number;
  transaction_date: string;
}

export interface StockFilters {
  locationFilter: string;
  productFilter: string;
  categoryFilter: string;
  batchFilter: string;
  expiryFromDate: string;
  expiryToDate: string;
}