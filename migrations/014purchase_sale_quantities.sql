-- Migration to fix sale quantities by making them positive
-- First, disable triggers to prevent unwanted side effects during migration
ALTER TABLE IF EXISTS public.stock_sales DISABLE TRIGGER update_mr_stock_summary_sales_trigger;

-- Update existing negative quantities to positive
UPDATE public.stock_sales
SET quantity_strips = ABS(quantity_strips)
WHERE quantity_strips < 0;

-- Update the constraint to ensure positive quantities
ALTER TABLE public.stock_sales
DROP CONSTRAINT IF EXISTS positive_sale_quantity;

ALTER TABLE public.stock_sales
ADD CONSTRAINT positive_sale_quantity CHECK (quantity_strips > 0);

-- Re-enable the trigger
ALTER TABLE IF EXISTS public.stock_sales ENABLE TRIGGER update_mr_stock_summary_sales_trigger;

-- Update the view to handle the sign change in the stock transactions view
CREATE OR REPLACE VIEW public.stock_transactions_view AS
-- Purchases (incoming stock)
SELECT
  purchase_id as transaction_id,
  purchase_group_id as transaction_group_id,
  product_id,
  batch_id,
  'STOCK_IN_GODOWN' as transaction_type,
  quantity_strips,
  'SUPPLIER' as location_type_source,
  supplier_id as location_id_source,
  'GODOWN' as location_type_destination,
  NULL as location_id_destination,
  purchase_date as transaction_date,
  'PURCHASE' as reference_document_type,
  reference_document_id,
  cost_per_strip as cost_per_strip_at_transaction,
  notes,
  created_by,
  created_at
FROM public.stock_purchases

UNION ALL

-- Sales (outgoing stock)
SELECT
  sale_id as transaction_id,
  sale_group_id as transaction_group_id,
  product_id,
  batch_id,
  transaction_type,
  -quantity_strips as quantity_strips, -- Negate here for the view
  location_type_source,
  location_id_source,
  location_type_destination,
  location_id_destination,
  sale_date as transaction_date,
  'SALE' as reference_document_type,
  reference_document_id,
  cost_per_strip as cost_per_strip_at_transaction,
  notes,
  created_by,
  created_at
FROM public.stock_sales

UNION ALL

-- Adjustments
SELECT
  adjustment_id as transaction_id,
  adjustment_group_id as transaction_group_id,
  product_id,
  batch_id,
  adjustment_type as transaction_type,
  quantity_strips,
  location_type_source,
  location_id_source,
  location_type_destination,
  location_id_destination,
  adjustment_date as transaction_date,
  'ADJUSTMENT' as reference_document_type,
  reference_document_id,
  cost_per_strip as cost_per_strip_at_transaction,
  notes,
  created_by,
  created_at
FROM public.stock_adjustments; 