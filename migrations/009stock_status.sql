
-- Create products_stock_status table to store real-time stock levels
CREATE TABLE public.products_stock_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id),
  location_type TEXT NOT NULL, -- 'GODOWN' or 'MR'
  location_id TEXT NOT NULL, -- specific location identifier
  current_quantity_strips INTEGER NOT NULL DEFAULT 0,
  cost_per_strip NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC GENERATED ALWAYS AS (current_quantity_strips * cost_per_strip) STORED,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of product, batch, and location
  UNIQUE(product_id, batch_id, location_type, location_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_products_stock_status_product_id ON public.products_stock_status(product_id);
CREATE INDEX idx_products_stock_status_batch_id ON public.products_stock_status(batch_id);
CREATE INDEX idx_products_stock_status_location ON public.products_stock_status(location_type, location_id);
CREATE INDEX idx_products_stock_status_current_quantity ON public.products_stock_status(current_quantity_strips) WHERE current_quantity_strips > 0;

-- Add trigger to update the updated_at timestamp
CREATE TRIGGER update_products_stock_status_updated_at
  BEFORE UPDATE ON public.products_stock_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update products_stock_status based on stock transactions
CREATE OR REPLACE FUNCTION public.update_products_stock_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Process destination location (incoming stock)
  IF NEW.location_type_destination IS NOT NULL AND NEW.location_id_destination IS NOT NULL THEN
    -- Calculate quantity change based on transaction type
    DECLARE
      quantity_change INTEGER := 0;
    BEGIN
      -- Incoming stock (positive)
      IF NEW.transaction_type LIKE '%STOCK_IN%' OR 
         NEW.transaction_type LIKE '%RETURN%' OR
         NEW.transaction_type LIKE '%REPLACEMENT_IN%' THEN
        quantity_change := NEW.quantity_strips;
      END IF;

      -- Update or insert stock status for destination
      IF quantity_change != 0 THEN
        INSERT INTO public.products_stock_status (
          product_id, 
          batch_id, 
          location_type, 
          location_id, 
          current_quantity_strips, 
          cost_per_strip,
          last_updated_at
        )
        VALUES (
          NEW.product_id,
          NEW.batch_id,
          NEW.location_type_destination,
          NEW.location_id_destination,
          quantity_change,
          NEW.cost_per_strip_at_transaction,
          now()
        )
        ON CONFLICT (product_id, batch_id, location_type, location_id)
        DO UPDATE SET
          current_quantity_strips = products_stock_status.current_quantity_strips + quantity_change,
          cost_per_strip = CASE 
            WHEN quantity_change > 0 THEN NEW.cost_per_strip_at_transaction
            ELSE products_stock_status.cost_per_strip
          END,
          last_updated_at = now();
      END IF;
    END;
  END IF;

  -- Process source location (outgoing stock)
  IF NEW.location_type_source IS NOT NULL AND NEW.location_id_source IS NOT NULL THEN
    -- Calculate quantity change based on transaction type
    DECLARE
      quantity_change INTEGER := 0;
    BEGIN
      -- Outgoing stock (negative)
      IF NEW.transaction_type LIKE '%DISPATCH%' OR 
         NEW.transaction_type LIKE '%SALE%' OR
         NEW.transaction_type LIKE '%DAMAGE%' OR
         NEW.transaction_type LIKE '%LOSS%' OR
         NEW.transaction_type LIKE '%REPLACEMENT_OUT%' THEN
        quantity_change := -ABS(NEW.quantity_strips);
      END IF;

      -- Update or insert stock status for source
      IF quantity_change != 0 THEN
        INSERT INTO public.products_stock_status (
          product_id, 
          batch_id, 
          location_type, 
          location_id, 
          current_quantity_strips, 
          cost_per_strip,
          last_updated_at
        )
        VALUES (
          NEW.product_id,
          NEW.batch_id,
          NEW.location_type_source,
          NEW.location_id_source,
          quantity_change,
          NEW.cost_per_strip_at_transaction,
          now()
        )
        ON CONFLICT (product_id, batch_id, location_type, location_id)
        DO UPDATE SET
          current_quantity_strips = products_stock_status.current_quantity_strips + quantity_change,
          last_updated_at = now();
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to automatically update products_stock_status when stock_transactions change
CREATE TRIGGER trigger_update_products_stock_status
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_stock_status();

-- Function to recalculate all stock status (useful for initial population or corrections)
CREATE OR REPLACE FUNCTION public.recalculate_products_stock_status()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Clear existing data
  TRUNCATE public.products_stock_status;
  
  -- Recalculate from all transactions
  INSERT INTO public.products_stock_status (
    product_id,
    batch_id,
    location_type,
    location_id,
    current_quantity_strips,
    cost_per_strip,
    last_updated_at
  )
  WITH stock_calculations AS (
    SELECT 
      product_id,
      batch_id,
      location_type,
      location_id,
      SUM(quantity_change) as total_quantity,
      -- Get the latest cost per strip for positive quantities
      (ARRAY_AGG(cost_per_strip_at_transaction ORDER BY created_at DESC))[1] as latest_cost
    FROM (
      -- Destination transactions (incoming stock)
      SELECT 
        product_id,
        batch_id,
        location_type_destination as location_type,
        location_id_destination as location_id,
        CASE 
          WHEN transaction_type LIKE '%STOCK_IN%' OR 
               transaction_type LIKE '%RETURN%' OR
               transaction_type LIKE '%REPLACEMENT_IN%' THEN quantity_strips
          ELSE 0
        END as quantity_change,
        cost_per_strip_at_transaction,
        created_at
      FROM public.stock_transactions
      WHERE location_type_destination IS NOT NULL 
        AND location_id_destination IS NOT NULL
      
      UNION ALL
      
      -- Source transactions (outgoing stock)
      SELECT 
        product_id,
        batch_id,
        location_type_source as location_type,
        location_id_source as location_id,
        CASE 
          WHEN transaction_type LIKE '%DISPATCH%' OR 
               transaction_type LIKE '%SALE%' OR
               transaction_type LIKE '%DAMAGE%' OR
               transaction_type LIKE '%LOSS%' OR
               transaction_type LIKE '%REPLACEMENT_OUT%' THEN -ABS(quantity_strips)
          ELSE 0
        END as quantity_change,
        cost_per_strip_at_transaction,
        created_at
      FROM public.stock_transactions
      WHERE location_type_source IS NOT NULL 
        AND location_id_source IS NOT NULL
    ) all_transactions
    WHERE quantity_change != 0
    GROUP BY product_id, batch_id, location_type, location_id
    HAVING SUM(quantity_change) > 0
  )
  SELECT 
    product_id,
    batch_id,
    location_type,
    location_id,
    total_quantity,
    latest_cost,
    now()
  FROM stock_calculations;
  
  RAISE NOTICE 'Stock status recalculated successfully';
END;
$$;

-- Populate the table with current stock data
SELECT public.recalculate_products_stock_status();
