
-- Create product_packaging_units table
CREATE TABLE public.product_packaging_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  conversion_factor_to_strips INTEGER NOT NULL DEFAULT 1,
  is_base_unit BOOLEAN NOT NULL DEFAULT FALSE,
  order_in_hierarchy INTEGER NOT NULL,
  default_purchase_unit BOOLEAN NOT NULL DEFAULT FALSE,
  default_sales_unit_mr BOOLEAN NOT NULL DEFAULT FALSE,
  default_sales_unit_direct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_product_unit_name UNIQUE (product_id, unit_name),
  CONSTRAINT positive_conversion_factor CHECK (conversion_factor_to_strips > 0),
  CONSTRAINT positive_order CHECK (order_in_hierarchy > 0)
);

-- Add updated_at trigger
CREATE TRIGGER update_product_packaging_units_updated_at
  BEFORE UPDATE ON public.product_packaging_units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_product_packaging_units_product_id ON public.product_packaging_units(product_id);
CREATE INDEX idx_product_packaging_units_order ON public.product_packaging_units(product_id, order_in_hierarchy);

-- Create validation function for base unit constraint
CREATE OR REPLACE FUNCTION validate_single_base_unit()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to set is_base_unit to true, check if another base unit exists
  IF NEW.is_base_unit = true THEN
    IF EXISTS (
      SELECT 1 FROM public.product_packaging_units 
      WHERE product_id = NEW.product_id 
      AND is_base_unit = true 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Only one base unit per product is allowed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add validation trigger
CREATE TRIGGER validate_single_base_unit_trigger
  BEFORE INSERT OR UPDATE ON public.product_packaging_units
  FOR EACH ROW
  EXECUTE FUNCTION validate_single_base_unit();
