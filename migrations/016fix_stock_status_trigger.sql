-- Drop and recreate the trigger function with corrected logic
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
      NEW.quantity_strips, -- Use quantity as is for destination
      NEW.cost_per_strip_at_transaction,
      now()
    )
    ON CONFLICT (product_id, batch_id, location_type, location_id)
    DO UPDATE SET
      current_quantity_strips = products_stock_status.current_quantity_strips + NEW.quantity_strips,
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
      -NEW.quantity_strips, -- Negate quantity for source
      NEW.cost_per_strip_at_transaction,
      now()
    )
    ON CONFLICT (product_id, batch_id, location_type, location_id)
    DO UPDATE SET
      current_quantity_strips = GREATEST(0, products_stock_status.current_quantity_strips - NEW.quantity_strips),
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

-- Recalculate all existing stock status from transactions
SELECT public.recalculate_products_stock_status(); 