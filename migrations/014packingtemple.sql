-- Create packaging_templates table for reusable packaging units
CREATE TABLE public.packaging_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  conversion_factor_to_strips INTEGER NOT NULL DEFAULT 1,
  is_base_unit BOOLEAN NOT NULL DEFAULT FALSE,
  order_in_hierarchy INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_template_unit_name UNIQUE (template_name, unit_name),
  CONSTRAINT positive_conversion_factor CHECK (conversion_factor_to_strips > 0),
  CONSTRAINT positive_order CHECK (order_in_hierarchy > 0)
);

-- Add updated_at trigger
CREATE TRIGGER update_packaging_templates_updated_at
  BEFORE UPDATE ON public.packaging_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_packaging_templates_name ON public.packaging_templates(template_name);

-- Add template_id column to product_packaging_units (nullable to maintain compatibility)
ALTER TABLE public.product_packaging_units
ADD COLUMN template_id UUID NULL REFERENCES public.packaging_templates(id) ON DELETE SET NULL;

-- Create index for the new column
CREATE INDEX idx_product_packaging_units_template_id ON public.product_packaging_units(template_id);

-- Insert some common packaging templates
INSERT INTO public.packaging_templates 
(template_name, unit_name, conversion_factor_to_strips, is_base_unit, order_in_hierarchy)
VALUES
('Standard Pharma', 'Strip', 1, true, 1),
('Standard Pharma', 'Box', 10, false, 2),
('Standard Pharma', 'Carton', 100, false, 3),
('Tablet Packaging', 'Strip', 1, true, 1),
('Tablet Packaging', 'Box', 10, false, 2),
('Tablet Packaging', 'Case', 50, false, 3),
('Liquid Medicine', 'Bottle', 1, true, 1),
('Liquid Medicine', 'Pack', 6, false, 2),
('Liquid Medicine', 'Carton', 24, false, 3); 