-- Migration to restructure stock transactions into separate purchase and sale tables

-- First, disable the trigger on stock_transactions to prevent unwanted side effects during migration
ALTER TABLE IF EXISTS public.stock_transactions DISABLE TRIGGER update_mr_stock_summary_trigger;

-- Create stock_purchases table
CREATE TABLE IF NOT EXISTS public.stock_purchases (
  purchase_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_group_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  quantity_strips INTEGER NOT NULL,
  supplier_id TEXT,
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference_document_id TEXT,
  cost_per_strip NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT positive_purchase_cost CHECK (cost_per_strip > 0),
  CONSTRAINT positive_purchase_quantity CHECK (quantity_strips > 0)
);

-- Create stock_sales table
CREATE TABLE IF NOT EXISTS public.stock_sales (
  sale_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_group_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL,
  quantity_strips INTEGER NOT NULL,
  location_type_source TEXT NOT NULL,
  location_id_source TEXT,
  location_type_destination TEXT NOT NULL,
  location_id_destination TEXT,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference_document_id TEXT,
  cost_per_strip NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_sale_transaction_type CHECK (transaction_type IN (
    'DISPATCH_TO_MR',
    'SALE_DIRECT_GODOWN',
    'SALE_BY_MR'
  )),
  CONSTRAINT valid_sale_location_source CHECK (location_type_source IN (
    'GODOWN', 'MR'
  )),
  CONSTRAINT valid_sale_location_destination CHECK (location_type_destination IN (
    'MR', 'CUSTOMER'
  )),
  CONSTRAINT positive_sale_cost CHECK (cost_per_strip > 0)
);

-- Create stock_adjustments table for returns, damages, etc.
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  adjustment_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_group_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL,
  quantity_strips INTEGER NOT NULL,
  location_type_source TEXT,
  location_id_source TEXT,
  location_type_destination TEXT,
  location_id_destination TEXT,
  adjustment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference_document_id TEXT,
  cost_per_strip NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_adjustment_type CHECK (adjustment_type IN (
    'RETURN_TO_GODOWN',
    'RETURN_TO_MR',
    'ADJUST_DAMAGE_GODOWN',
    'ADJUST_LOSS_GODOWN',
    'ADJUST_DAMAGE_MR',
    'ADJUST_LOSS_MR',
    'ADJUST_EXPIRED_GODOWN',
    'ADJUST_EXPIRED_MR',
    'REPLACEMENT_FROM_GODOWN',
    'REPLACEMENT_FROM_MR',
    'OPENING_STOCK_GODOWN',
    'OPENING_STOCK_MR'
  )),
  CONSTRAINT positive_adjustment_cost CHECK (cost_per_strip > 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_stock_purchases_group_id ON public.stock_purchases(purchase_group_id);
CREATE INDEX idx_stock_purchases_product_id ON public.stock_purchases(product_id);
CREATE INDEX idx_stock_purchases_batch_id ON public.stock_purchases(batch_id);
CREATE INDEX idx_stock_purchases_date ON public.stock_purchases(purchase_date);
CREATE INDEX idx_stock_purchases_created_by ON public.stock_purchases(created_by);

CREATE INDEX idx_stock_sales_group_id ON public.stock_sales(sale_group_id);
CREATE INDEX idx_stock_sales_product_id ON public.stock_sales(product_id);
CREATE INDEX idx_stock_sales_batch_id ON public.stock_sales(batch_id);
CREATE INDEX idx_stock_sales_type ON public.stock_sales(transaction_type);
CREATE INDEX idx_stock_sales_date ON public.stock_sales(sale_date);
CREATE INDEX idx_stock_sales_created_by ON public.stock_sales(created_by);

CREATE INDEX idx_stock_adjustments_group_id ON public.stock_adjustments(adjustment_group_id);
CREATE INDEX idx_stock_adjustments_product_id ON public.stock_adjustments(product_id);
CREATE INDEX idx_stock_adjustments_batch_id ON public.stock_adjustments(batch_id);
CREATE INDEX idx_stock_adjustments_type ON public.stock_adjustments(adjustment_type);
CREATE INDEX idx_stock_adjustments_date ON public.stock_adjustments(adjustment_date);
CREATE INDEX idx_stock_adjustments_created_by ON public.stock_adjustments(created_by);

-- Create a view that combines all three tables to maintain compatibility with existing code
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
  quantity_strips,
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

-- Create functions to update MR stock summary from the new tables
CREATE OR REPLACE FUNCTION update_mr_stock_summary_from_sales()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle MR as destination (stock increase)
  IF NEW.location_type_destination = 'MR' AND NEW.location_id_destination IS NOT NULL THEN
    INSERT INTO public.mr_stock_summary (mr_user_id, product_id, batch_id, current_quantity_strips, last_updated_at)
    VALUES (NEW.location_id_destination::UUID, NEW.product_id, NEW.batch_id, NEW.quantity_strips, now())
    ON CONFLICT (mr_user_id, product_id, batch_id)
    DO UPDATE SET 
      current_quantity_strips = mr_stock_summary.current_quantity_strips + NEW.quantity_strips,
      last_updated_at = now();
  END IF;
  
  -- Handle MR as source (stock decrease)
  IF NEW.location_type_source = 'MR' AND NEW.location_id_source IS NOT NULL THEN
    INSERT INTO public.mr_stock_summary (mr_user_id, product_id, batch_id, current_quantity_strips, last_updated_at)
    VALUES (NEW.location_id_source::UUID, NEW.product_id, NEW.batch_id, -NEW.quantity_strips, now())
    ON CONFLICT (mr_user_id, product_id, batch_id)
    DO UPDATE SET 
      current_quantity_strips = mr_stock_summary.current_quantity_strips - NEW.quantity_strips,
      last_updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_mr_stock_summary_from_adjustments()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle MR as destination (stock increase)
  IF NEW.location_type_destination = 'MR' AND NEW.location_id_destination IS NOT NULL THEN
    INSERT INTO public.mr_stock_summary (mr_user_id, product_id, batch_id, current_quantity_strips, last_updated_at)
    VALUES (NEW.location_id_destination::UUID, NEW.product_id, NEW.batch_id, NEW.quantity_strips, now())
    ON CONFLICT (mr_user_id, product_id, batch_id)
    DO UPDATE SET 
      current_quantity_strips = mr_stock_summary.current_quantity_strips + NEW.quantity_strips,
      last_updated_at = now();
  END IF;
  
  -- Handle MR as source (stock decrease)
  IF NEW.location_type_source = 'MR' AND NEW.location_id_source IS NOT NULL THEN
    INSERT INTO public.mr_stock_summary (mr_user_id, product_id, batch_id, current_quantity_strips, last_updated_at)
    VALUES (NEW.location_id_source::UUID, NEW.product_id, NEW.batch_id, -NEW.quantity_strips, now())
    ON CONFLICT (mr_user_id, product_id, batch_id)
    DO UPDATE SET 
      current_quantity_strips = mr_stock_summary.current_quantity_strips - NEW.quantity_strips,
      last_updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for the new tables
CREATE TRIGGER update_mr_stock_summary_sales_trigger
  AFTER INSERT ON public.stock_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_mr_stock_summary_from_sales();

CREATE TRIGGER update_mr_stock_summary_adjustments_trigger
  AFTER INSERT ON public.stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_mr_stock_summary_from_adjustments();

-- Note: We don't need a trigger for stock_purchases as they don't directly affect MR stock

-- Keep the stock_transactions table active for now
-- In the future, we may want to migrate all data and deprecate it
-- Re-enable the trigger on stock_transactions
ALTER TABLE IF EXISTS public.stock_transactions ENABLE TRIGGER update_mr_stock_summary_trigger; 