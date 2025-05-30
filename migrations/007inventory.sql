
-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS stock_transactions_trigger ON public.stock_transactions;
DROP FUNCTION IF EXISTS public.update_mr_stock_summary() CASCADE;

-- Drop tables if they exist
DROP TABLE IF EXISTS public.mr_stock_summary CASCADE;
DROP TABLE IF EXISTS public.stock_transactions CASCADE;

-- Create stock_transactions table - the core table for inventory tracking
CREATE TABLE public.stock_transactions (
  transaction_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_group_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL,
  quantity_strips INTEGER NOT NULL,
  location_type_source TEXT,
  location_id_source TEXT,
  location_type_destination TEXT,
  location_id_destination TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference_document_type TEXT,
  reference_document_id TEXT,
  cost_per_strip_at_transaction NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN (
    'STOCK_IN_GODOWN',
    'DISPATCH_TO_MR',
    'SALE_DIRECT_GODOWN',
    'SALE_BY_MR',
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
  CONSTRAINT valid_location_source CHECK (location_type_source IN (
    'SUPPLIER', 'GODOWN', 'MR', 'CUSTOMER'
  ) OR location_type_source IS NULL),
  CONSTRAINT valid_location_destination CHECK (location_type_destination IN (
    'SUPPLIER', 'GODOWN', 'MR', 'CUSTOMER', 'WASTAGE_BIN'
  ) OR location_type_destination IS NULL),
  CONSTRAINT positive_cost CHECK (cost_per_strip_at_transaction > 0)
);

-- Create helper table for MR stock summary
CREATE TABLE public.mr_stock_summary (
  mr_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE CASCADE,
  current_quantity_strips INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (mr_user_id, product_id, batch_id),
  CONSTRAINT non_negative_quantity CHECK (current_quantity_strips >= 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_stock_transactions_group_id ON public.stock_transactions(transaction_group_id);
CREATE INDEX idx_stock_transactions_product_id ON public.stock_transactions(product_id);
CREATE INDEX idx_stock_transactions_batch_id ON public.stock_transactions(batch_id);
CREATE INDEX idx_stock_transactions_type ON public.stock_transactions(transaction_type);
CREATE INDEX idx_stock_transactions_date ON public.stock_transactions(transaction_date);
CREATE INDEX idx_stock_transactions_created_by ON public.stock_transactions(created_by);
CREATE INDEX idx_mr_stock_summary_mr_user ON public.mr_stock_summary(mr_user_id);
CREATE INDEX idx_mr_stock_summary_product ON public.mr_stock_summary(product_id);

-- Create function to update MR stock summary
CREATE OR REPLACE FUNCTION update_mr_stock_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process transactions that affect MR stock
  IF NEW.location_type_destination = 'MR' OR NEW.location_type_source = 'MR' THEN
    
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
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update MR stock summary
CREATE TRIGGER update_mr_stock_summary_trigger
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_mr_stock_summary();
