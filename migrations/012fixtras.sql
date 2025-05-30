
-- Fix the trigger function to not insert into total_value column
DROP FUNCTION IF EXISTS public.update_products_stock_status() CASCADE;

CREATE OR REPLACE FUNCTION public.update_products_stock_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Process destination location (incoming stock - positive quantities)
  IF NEW.location_type_destination IS NOT NULL AND NEW.location_id_destination IS NOT NULL THEN
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
      ABS(NEW.quantity_strips), -- Always positive for destination
      NEW.cost_per_strip_at_transaction,
      now()
    )
    ON CONFLICT (product_id, batch_id, location_type, location_id)
    DO UPDATE SET
      current_quantity_strips = products_stock_status.current_quantity_strips + ABS(NEW.quantity_strips),
      cost_per_strip = NEW.cost_per_strip_at_transaction,
      last_updated_at = now();
  END IF;

  -- Process source location (outgoing stock - negative quantities)
  IF NEW.location_type_source IS NOT NULL AND NEW.location_id_source IS NOT NULL THEN
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
      -ABS(NEW.quantity_strips), -- Always negative for source
      NEW.cost_per_strip_at_transaction,
      now()
    )
    ON CONFLICT (product_id, batch_id, location_type, location_id)
    DO UPDATE SET
      current_quantity_strips = GREATEST(0, products_stock_status.current_quantity_strips - ABS(NEW.quantity_strips)),
      last_updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_update_products_stock_status
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_stock_status();

-- Update the recalculate function to not insert into total_value
CREATE OR REPLACE FUNCTION public.recalculate_products_stock_status()
RETURNS void
LANGUAGE plpgsql
AS $function$
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
$function$;

-- Recalculate all existing stock status from transactions
SELECT public.recalculate_products_stock_status();
