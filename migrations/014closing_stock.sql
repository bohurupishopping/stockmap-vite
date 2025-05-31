-- Migration to create closing_stock table with automatic triggers

-- Create closing_stock table to store real-time stock levels
CREATE TABLE IF NOT EXISTS public.closing_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  location_type TEXT NOT NULL,  -- 'GODOWN' or 'MR'
  location_id TEXT,             -- Empty for GODOWN, user_id for MR
  quantity_strips INTEGER NOT NULL DEFAULT 0,
  cost_per_strip NUMERIC(10,2) NOT NULL,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_product_batch_location UNIQUE (product_id, batch_id, location_type, location_id),
  CONSTRAINT valid_location_type CHECK (location_type IN ('GODOWN', 'MR')),
  CONSTRAINT non_negative_quantity CHECK (quantity_strips >= 0)
);

-- Create indexes for better query performance (with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_closing_stock_product_id') THEN
    CREATE INDEX idx_closing_stock_product_id ON public.closing_stock(product_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_closing_stock_batch_id') THEN
    CREATE INDEX idx_closing_stock_batch_id ON public.closing_stock(batch_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_closing_stock_location') THEN
    CREATE INDEX idx_closing_stock_location ON public.closing_stock(location_type, location_id);
  END IF;
END $$;

-- Create view to easily access closing stock with product and batch details
CREATE OR REPLACE VIEW public.closing_stock_view AS
SELECT 
  cs.id,
  cs.product_id,
  p.product_code,
  p.product_name,
  p.generic_name,
  cs.batch_id,
  pb.batch_number,
  pb.expiry_date,
  cs.location_type,
  cs.location_id,
  cs.quantity_strips,
  cs.cost_per_strip,
  (cs.quantity_strips * cs.cost_per_strip) AS total_value,
  p.category_id,
  pc.category_name,
  p.min_stock_level_godown,
  p.min_stock_level_mr,
  cs.last_updated_at
FROM 
  public.closing_stock cs
JOIN 
  public.products p ON cs.product_id = p.id
JOIN 
  public.product_batches pb ON cs.batch_id = pb.id
LEFT JOIN
  public.product_categories pc ON p.category_id = pc.id;

-- Function to update closing stock
CREATE OR REPLACE FUNCTION update_closing_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_batch_id UUID;
  v_location_type TEXT;
  v_location_id TEXT;
  v_quantity_change INTEGER;
  v_cost_per_strip NUMERIC(10,2);
  v_current_record RECORD;
BEGIN
  -- Determine which table triggered this function
  IF TG_TABLE_NAME = 'stock_purchases' THEN
    -- For purchases, always add to GODOWN
    v_product_id := NEW.product_id;
    v_batch_id := NEW.batch_id;
    v_location_type := 'GODOWN';
    v_location_id := '';
    v_quantity_change := NEW.quantity_strips;
    v_cost_per_strip := NEW.cost_per_strip;
    
  ELSIF TG_TABLE_NAME = 'stock_sales' THEN
    v_product_id := NEW.product_id;
    v_batch_id := NEW.batch_id;
    v_cost_per_strip := NEW.cost_per_strip;
    
    IF TG_OP = 'INSERT' THEN
      -- For sales, handle based on transaction type
      IF NEW.transaction_type = 'DISPATCH_TO_MR' THEN
        -- Decrease from source (GODOWN)
        UPDATE public.closing_stock
        SET quantity_strips = GREATEST(0, quantity_strips - NEW.quantity_strips),
            last_updated_at = now()
        WHERE product_id = NEW.product_id
          AND batch_id = NEW.batch_id
          AND location_type = NEW.location_type_source
          AND (location_id = NEW.location_id_source OR (NEW.location_id_source IS NULL AND location_id = ''));
          
        -- Increase at destination (MR)
        INSERT INTO public.closing_stock (
          product_id, batch_id, location_type, location_id, 
          quantity_strips, cost_per_strip, last_updated_at
        ) VALUES (
          NEW.product_id, NEW.batch_id, NEW.location_type_destination, NEW.location_id_destination,
          NEW.quantity_strips, NEW.cost_per_strip, now()
        ) ON CONFLICT (product_id, batch_id, location_type, location_id)
        DO UPDATE SET 
          quantity_strips = public.closing_stock.quantity_strips + NEW.quantity_strips,
          cost_per_strip = NEW.cost_per_strip,
          last_updated_at = now();
          
        -- Return early as we've handled this case specifically
        RETURN NEW;
      ELSIF NEW.transaction_type IN ('SALE_DIRECT_GODOWN', 'SALE_BY_MR') THEN
        -- For sales, decrease from source
        v_location_type := NEW.location_type_source;
        v_location_id := COALESCE(NEW.location_id_source, '');
        v_quantity_change := -NEW.quantity_strips;
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      -- Reverse the effect of the deleted sale
      IF OLD.transaction_type = 'DISPATCH_TO_MR' THEN
        -- Add back to source (GODOWN)
        UPDATE public.closing_stock
        SET quantity_strips = quantity_strips + OLD.quantity_strips,
            last_updated_at = now()
        WHERE product_id = OLD.product_id
          AND batch_id = OLD.batch_id
          AND location_type = OLD.location_type_source
          AND (location_id = OLD.location_id_source OR (OLD.location_id_source IS NULL AND location_id = ''));
          
        -- Remove from destination (MR)
        UPDATE public.closing_stock
        SET quantity_strips = GREATEST(0, quantity_strips - OLD.quantity_strips),
            last_updated_at = now()
        WHERE product_id = OLD.product_id
          AND batch_id = OLD.batch_id
          AND location_type = OLD.location_type_destination
          AND location_id = OLD.location_id_destination;
          
        -- Return early as we've handled this case specifically
        RETURN OLD;
      ELSIF OLD.transaction_type IN ('SALE_DIRECT_GODOWN', 'SALE_BY_MR') THEN
        -- For deleted sales, add back to source
        v_product_id := OLD.product_id;
        v_batch_id := OLD.batch_id;
        v_location_type := OLD.location_type_source;
        v_location_id := COALESCE(OLD.location_id_source, '');
        v_quantity_change := OLD.quantity_strips;
        v_cost_per_strip := OLD.cost_per_strip;
      END IF;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'stock_adjustments' THEN
    v_product_id := NEW.product_id;
    v_batch_id := NEW.batch_id;
    v_cost_per_strip := NEW.cost_per_strip;
    
    IF TG_OP = 'INSERT' THEN
      -- For adjustments, handle based on adjustment type
      IF NEW.adjustment_type LIKE 'RETURN_TO_GODOWN%' THEN
        -- Add to GODOWN
        UPDATE public.closing_stock
        SET quantity_strips = quantity_strips + NEW.quantity_strips,
            last_updated_at = now()
        WHERE product_id = NEW.product_id
          AND batch_id = NEW.batch_id
          AND location_type = 'GODOWN'
          AND location_id = '';
          
        -- Remove from MR if that's the source
        IF NEW.location_type_source = 'MR' AND NEW.location_id_source IS NOT NULL THEN
          UPDATE public.closing_stock
          SET quantity_strips = GREATEST(0, quantity_strips - NEW.quantity_strips),
              last_updated_at = now()
          WHERE product_id = NEW.product_id
            AND batch_id = NEW.batch_id
            AND location_type = 'MR'
            AND location_id = NEW.location_id_source;
        END IF;
        
        -- Return early as we've handled this case specifically
        RETURN NEW;
      ELSIF NEW.adjustment_type LIKE 'ADJUST_DAMAGE_%' OR 
            NEW.adjustment_type LIKE 'ADJUST_LOSS_%' OR 
            NEW.adjustment_type LIKE 'ADJUST_EXPIRED_%' THEN
        -- For losses/damages, decrease from source
        IF NEW.adjustment_type LIKE '%_GODOWN' THEN
          v_location_type := 'GODOWN';
          v_location_id := '';
        ELSIF NEW.adjustment_type LIKE '%_MR' THEN
          v_location_type := 'MR';
          v_location_id := COALESCE(NEW.location_id_source, '');
        END IF;
        v_quantity_change := -NEW.quantity_strips;
      ELSIF NEW.adjustment_type LIKE 'OPENING_STOCK_%' THEN
        -- For opening stock, add to location
        IF NEW.adjustment_type = 'OPENING_STOCK_GODOWN' THEN
          v_location_type := 'GODOWN';
          v_location_id := '';
        ELSIF NEW.adjustment_type = 'OPENING_STOCK_MR' THEN
          v_location_type := 'MR';
          v_location_id := COALESCE(NEW.location_id_destination, '');
        END IF;
        v_quantity_change := NEW.quantity_strips;
      ELSIF NEW.adjustment_type LIKE 'REPLACEMENT_%' THEN
        -- For replacements, decrease from source
        IF NEW.adjustment_type = 'REPLACEMENT_FROM_GODOWN' THEN
          v_location_type := 'GODOWN';
          v_location_id := '';
        ELSIF NEW.adjustment_type = 'REPLACEMENT_FROM_MR' THEN
          v_location_type := 'MR';
          v_location_id := COALESCE(NEW.location_id_source, '');
        END IF;
        v_quantity_change := -NEW.quantity_strips;
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      -- Reverse the effect of the deleted adjustment
      IF OLD.adjustment_type LIKE 'RETURN_TO_GODOWN%' THEN
        -- Remove from GODOWN
        UPDATE public.closing_stock
        SET quantity_strips = GREATEST(0, quantity_strips - OLD.quantity_strips),
            last_updated_at = now()
        WHERE product_id = OLD.product_id
          AND batch_id = OLD.batch_id
          AND location_type = 'GODOWN'
          AND location_id = '';
          
        -- Add back to MR if that was the source
        IF OLD.location_type_source = 'MR' AND OLD.location_id_source IS NOT NULL THEN
          UPDATE public.closing_stock
          SET quantity_strips = quantity_strips + OLD.quantity_strips,
              last_updated_at = now()
          WHERE product_id = OLD.product_id
            AND batch_id = OLD.batch_id
            AND location_type = 'MR'
            AND location_id = OLD.location_id_source;
        END IF;
        
        -- Return early as we've handled this case specifically
        RETURN OLD;
      ELSIF OLD.adjustment_type LIKE 'ADJUST_DAMAGE_%' OR 
            OLD.adjustment_type LIKE 'ADJUST_LOSS_%' OR 
            OLD.adjustment_type LIKE 'ADJUST_EXPIRED_%' THEN
        -- For deleted losses/damages, add back to source
        v_product_id := OLD.product_id;
        v_batch_id := OLD.batch_id;
        IF OLD.adjustment_type LIKE '%_GODOWN' THEN
          v_location_type := 'GODOWN';
          v_location_id := '';
        ELSIF OLD.adjustment_type LIKE '%_MR' THEN
          v_location_type := 'MR';
          v_location_id := COALESCE(OLD.location_id_source, '');
        END IF;
        v_quantity_change := OLD.quantity_strips;
        v_cost_per_strip := OLD.cost_per_strip;
      ELSIF OLD.adjustment_type LIKE 'OPENING_STOCK_%' THEN
        -- For deleted opening stock, remove from location
        v_product_id := OLD.product_id;
        v_batch_id := OLD.batch_id;
        IF OLD.adjustment_type = 'OPENING_STOCK_GODOWN' THEN
          v_location_type := 'GODOWN';
          v_location_id := '';
        ELSIF OLD.adjustment_type = 'OPENING_STOCK_MR' THEN
          v_location_type := 'MR';
          v_location_id := COALESCE(OLD.location_id_destination, '');
        END IF;
        v_quantity_change := -OLD.quantity_strips;
        v_cost_per_strip := OLD.cost_per_strip;
      ELSIF OLD.adjustment_type LIKE 'REPLACEMENT_%' THEN
        -- For deleted replacements, add back to source
        v_product_id := OLD.product_id;
        v_batch_id := OLD.batch_id;
        IF OLD.adjustment_type = 'REPLACEMENT_FROM_GODOWN' THEN
          v_location_type := 'GODOWN';
          v_location_id := '';
        ELSIF OLD.adjustment_type = 'REPLACEMENT_FROM_MR' THEN
          v_location_type := 'MR';
          v_location_id := COALESCE(OLD.location_id_source, '');
        END IF;
        v_quantity_change := OLD.quantity_strips;
        v_cost_per_strip := OLD.cost_per_strip;
      END IF;
    END IF;
  END IF;

  -- If we have all necessary values, update the closing_stock table
  IF v_product_id IS NOT NULL AND v_batch_id IS NOT NULL AND 
     v_location_type IS NOT NULL AND v_quantity_change IS NOT NULL THEN
    
    -- Normalize location_id to empty string if NULL
    v_location_id := COALESCE(v_location_id, '');
    
    -- Check if record exists
    SELECT * INTO v_current_record 
    FROM public.closing_stock 
    WHERE product_id = v_product_id 
      AND batch_id = v_batch_id 
      AND location_type = v_location_type 
      AND location_id = v_location_id;
    
    IF FOUND THEN
      -- Update existing record
      UPDATE public.closing_stock
      SET quantity_strips = GREATEST(0, quantity_strips + v_quantity_change),
          -- Only update cost_per_strip if it's an inflow (positive quantity change)
          cost_per_strip = CASE WHEN v_quantity_change > 0 THEN v_cost_per_strip ELSE cost_per_strip END,
          last_updated_at = now()
      WHERE product_id = v_product_id
        AND batch_id = v_batch_id
        AND location_type = v_location_type
        AND location_id = v_location_id;
    ELSE
      -- Only insert for positive quantity changes
      IF v_quantity_change > 0 THEN
        INSERT INTO public.closing_stock (
          product_id, batch_id, location_type, location_id, 
          quantity_strips, cost_per_strip, last_updated_at
        ) VALUES (
          v_product_id, v_batch_id, v_location_type, v_location_id,
          v_quantity_change, v_cost_per_strip, now()
        );
      END IF;
    END IF;
  END IF;
  
  -- Return the appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for each table (with DROP IF EXISTS)
DROP TRIGGER IF EXISTS update_closing_stock_purchases_trigger ON public.stock_purchases;
CREATE TRIGGER update_closing_stock_purchases_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_closing_stock();

DROP TRIGGER IF EXISTS update_closing_stock_sales_trigger ON public.stock_sales;
CREATE TRIGGER update_closing_stock_sales_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_closing_stock();

DROP TRIGGER IF EXISTS update_closing_stock_adjustments_trigger ON public.stock_adjustments;
CREATE TRIGGER update_closing_stock_adjustments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_closing_stock();

-- Function to populate initial closing_stock data from existing transactions
CREATE OR REPLACE FUNCTION populate_initial_closing_stock()
RETURNS void AS $$
BEGIN
  -- Clear existing data
  TRUNCATE TABLE public.closing_stock;
  
  -- Process all transactions to rebuild the closing stock following the accounting rule:
  -- opening + purchases - sales - returns - adjustments = closing
  
  -- Step 1: Process opening stock (positive)
  INSERT INTO public.closing_stock (
    product_id, batch_id, location_type, location_id, 
    quantity_strips, cost_per_strip, last_updated_at
  )
  SELECT 
    product_id, 
    batch_id, 
    CASE 
      WHEN adjustment_type = 'OPENING_STOCK_GODOWN' THEN 'GODOWN'
      WHEN adjustment_type = 'OPENING_STOCK_MR' THEN 'MR'
    END AS location_type,
    CASE 
      WHEN adjustment_type = 'OPENING_STOCK_GODOWN' THEN ''
      WHEN adjustment_type = 'OPENING_STOCK_MR' THEN COALESCE(location_id_destination, '')
    END AS location_id,
    SUM(quantity_strips), 
    MAX(cost_per_strip),
    MAX(adjustment_date)
  FROM 
    public.stock_adjustments
  WHERE 
    adjustment_type IN ('OPENING_STOCK_GODOWN', 'OPENING_STOCK_MR')
  GROUP BY 
    product_id, 
    batch_id, 
    adjustment_type,
    location_id_destination
  ON CONFLICT (product_id, batch_id, location_type, location_id)
  DO UPDATE SET 
    quantity_strips = public.closing_stock.quantity_strips + EXCLUDED.quantity_strips,
    last_updated_at = GREATEST(public.closing_stock.last_updated_at, EXCLUDED.last_updated_at);
  
  -- Step 2: Add purchases (positive)
  INSERT INTO public.closing_stock (
    product_id, batch_id, location_type, location_id, 
    quantity_strips, cost_per_strip, last_updated_at
  )
  SELECT 
    product_id, 
    batch_id, 
    'GODOWN', 
    '', 
    SUM(quantity_strips), 
    MAX(cost_per_strip),
    MAX(purchase_date)
  FROM 
    public.stock_purchases
  GROUP BY 
    product_id, batch_id
  ON CONFLICT (product_id, batch_id, location_type, location_id)
  DO UPDATE SET 
    quantity_strips = public.closing_stock.quantity_strips + EXCLUDED.quantity_strips,
    last_updated_at = GREATEST(public.closing_stock.last_updated_at, EXCLUDED.last_updated_at);
  
  -- Step 3: Subtract sales (negative)
  -- Direct sales from GODOWN
  UPDATE public.closing_stock cs
  SET quantity_strips = GREATEST(0, cs.quantity_strips - subquery.total_quantity)
  FROM (
    SELECT 
      product_id, 
      batch_id, 
      SUM(quantity_strips) as total_quantity
    FROM 
      public.stock_sales
    WHERE 
      transaction_type = 'SALE_DIRECT_GODOWN'
      AND location_type_source = 'GODOWN'
    GROUP BY 
      product_id, batch_id
  ) as subquery
  WHERE 
    cs.product_id = subquery.product_id
    AND cs.batch_id = subquery.batch_id
    AND cs.location_type = 'GODOWN';
  
  -- Sales by MR
  UPDATE public.closing_stock cs
  SET quantity_strips = GREATEST(0, cs.quantity_strips - subquery.total_quantity)
  FROM (
    SELECT 
      product_id, 
      batch_id, 
      location_id_source,
      SUM(quantity_strips) as total_quantity
    FROM 
      public.stock_sales
    WHERE 
      transaction_type = 'SALE_BY_MR'
      AND location_type_source = 'MR'
      AND location_id_source IS NOT NULL
    GROUP BY 
      product_id, batch_id, location_id_source
  ) as subquery
  WHERE 
    cs.product_id = subquery.product_id
    AND cs.batch_id = subquery.batch_id
    AND cs.location_type = 'MR'
    AND cs.location_id = subquery.location_id_source;
  
  -- Step 4: Handle dispatch to MR (internal transfer, not sale)
  -- This is a stock movement: decrease from GODOWN
  UPDATE public.closing_stock cs
  SET quantity_strips = GREATEST(0, cs.quantity_strips - subquery.total_quantity)
  FROM (
    SELECT 
      product_id, 
      batch_id, 
      SUM(quantity_strips) as total_quantity
    FROM 
      public.stock_sales
    WHERE 
      transaction_type = 'DISPATCH_TO_MR'
      AND location_type_source = 'GODOWN'
    GROUP BY 
      product_id, batch_id
  ) as subquery
  WHERE 
    cs.product_id = subquery.product_id
    AND cs.batch_id = subquery.batch_id
    AND cs.location_type = 'GODOWN';
  
  -- And increase in MR
  INSERT INTO public.closing_stock (
    product_id, batch_id, location_type, location_id, 
    quantity_strips, cost_per_strip, last_updated_at
  )
  SELECT 
    product_id, 
    batch_id, 
    'MR', 
    location_id_destination, 
    SUM(quantity_strips), 
    MAX(cost_per_strip),
    MAX(sale_date)
  FROM 
    public.stock_sales
  WHERE 
    transaction_type = 'DISPATCH_TO_MR'
    AND location_type_destination = 'MR'
    AND location_id_destination IS NOT NULL
  GROUP BY 
    product_id, batch_id, location_id_destination
  ON CONFLICT (product_id, batch_id, location_type, location_id)
  DO UPDATE SET 
    quantity_strips = public.closing_stock.quantity_strips + EXCLUDED.quantity_strips,
    last_updated_at = GREATEST(public.closing_stock.last_updated_at, EXCLUDED.last_updated_at);
  
  -- Step 5: Handle returns (negative for accounting)
  -- Returns to GODOWN from MR (decrease MR stock)
  UPDATE public.closing_stock cs
  SET quantity_strips = GREATEST(0, cs.quantity_strips - subquery.total_quantity)
  FROM (
    SELECT 
      product_id, 
      batch_id, 
      location_id_source,
      SUM(quantity_strips) as total_quantity
    FROM 
      public.stock_adjustments
    WHERE 
      adjustment_type LIKE 'RETURN_TO_GODOWN%'
      AND location_type_source = 'MR'
      AND location_id_source IS NOT NULL
    GROUP BY 
      product_id, batch_id, location_id_source
  ) as subquery
  WHERE 
    cs.product_id = subquery.product_id
    AND cs.batch_id = subquery.batch_id
    AND cs.location_type = 'MR'
    AND cs.location_id = subquery.location_id_source;
  
  -- Returns to GODOWN (increase GODOWN stock)
  UPDATE public.closing_stock cs
  SET quantity_strips = cs.quantity_strips + subquery.total_quantity
  FROM (
    SELECT 
      product_id, 
      batch_id, 
      SUM(quantity_strips) as total_quantity
    FROM 
      public.stock_adjustments
    WHERE 
      adjustment_type LIKE 'RETURN_TO_GODOWN%'
    GROUP BY 
      product_id, batch_id
  ) as subquery
  WHERE 
    cs.product_id = subquery.product_id
    AND cs.batch_id = subquery.batch_id
    AND cs.location_type = 'GODOWN';
  
  -- Step 6: Subtract adjustments (negative)
  -- Damage/loss/expired adjustments
  UPDATE public.closing_stock cs
  SET quantity_strips = GREATEST(0, cs.quantity_strips - subquery.total_quantity)
  FROM (
    SELECT 
      product_id, 
      batch_id, 
      CASE 
        WHEN adjustment_type LIKE '%_GODOWN' THEN 'GODOWN'
        WHEN adjustment_type LIKE '%_MR' THEN 'MR'
      END as loc_type,
      CASE 
        WHEN adjustment_type LIKE '%_GODOWN' THEN ''
        WHEN adjustment_type LIKE '%_MR' THEN COALESCE(location_id_source, '')
      END as loc_id,
      SUM(quantity_strips) as total_quantity
    FROM 
      public.stock_adjustments
    WHERE 
      adjustment_type LIKE 'ADJUST_DAMAGE_%' OR
      adjustment_type LIKE 'ADJUST_LOSS_%' OR
      adjustment_type LIKE 'ADJUST_EXPIRED_%'
    GROUP BY 
      product_id, 
      batch_id, 
      adjustment_type,
      location_id_source
  ) as subquery
  WHERE 
    cs.product_id = subquery.product_id
    AND cs.batch_id = subquery.batch_id
    AND cs.location_type = subquery.loc_type
    AND cs.location_id = subquery.loc_id;
  
  -- Handle replacements (negative for source)
  UPDATE public.closing_stock cs
  SET quantity_strips = GREATEST(0, cs.quantity_strips - subquery.total_quantity)
  FROM (
    SELECT 
      product_id, 
      batch_id, 
      CASE 
        WHEN adjustment_type = 'REPLACEMENT_FROM_GODOWN' THEN 'GODOWN'
        WHEN adjustment_type = 'REPLACEMENT_FROM_MR' THEN 'MR'
      END as loc_type,
      CASE 
        WHEN adjustment_type = 'REPLACEMENT_FROM_GODOWN' THEN ''
        WHEN adjustment_type = 'REPLACEMENT_FROM_MR' THEN COALESCE(location_id_source, '')
      END as loc_id,
      SUM(quantity_strips) as total_quantity
    FROM 
      public.stock_adjustments
    WHERE 
      adjustment_type LIKE 'REPLACEMENT_%'
    GROUP BY 
      product_id, 
      batch_id, 
      adjustment_type,
      location_id_source
  ) as subquery
  WHERE 
    cs.product_id = subquery.product_id
    AND cs.batch_id = subquery.batch_id
    AND cs.location_type = subquery.loc_type
    AND cs.location_id = subquery.loc_id;
  
  -- Delete any records with zero or negative quantity
  DELETE FROM public.closing_stock WHERE quantity_strips <= 0;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to populate initial data
SELECT populate_initial_closing_stock();

-- Add RLS policies for closing_stock (with DROP IF EXISTS)
ALTER TABLE public.closing_stock ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can do everything on closing_stock" ON public.closing_stock;
DROP POLICY IF EXISTS "Users can view closing_stock" ON public.closing_stock;

-- Create policy for admins - full access to closing_stock
CREATE POLICY "Admins can do everything on closing_stock" 
  ON public.closing_stock 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create policy for users - read only for closing_stock
CREATE POLICY "Users can view closing_stock" 
  ON public.closing_stock 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'user')
    )
  ); 