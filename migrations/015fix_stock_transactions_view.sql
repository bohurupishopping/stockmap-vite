-- Migration to fix stock transactions view to handle sales quantities correctly
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
  CASE 
    WHEN transaction_type = 'DISPATCH_TO_MR' THEN quantity_strips
    WHEN transaction_type = 'SALE_DIRECT_GODOWN' THEN -quantity_strips
    WHEN transaction_type = 'SALE_BY_MR' THEN -quantity_strips
    ELSE quantity_strips
  END as quantity_strips,
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
  CASE 
    WHEN adjustment_type LIKE 'RETURN_TO_%' THEN quantity_strips
    WHEN adjustment_type LIKE 'ADJUST_%' THEN -quantity_strips
    WHEN adjustment_type LIKE 'OPENING_STOCK_%' THEN quantity_strips
    WHEN adjustment_type LIKE 'REPLACEMENT_%' THEN -quantity_strips
    ELSE quantity_strips
  END as quantity_strips,
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