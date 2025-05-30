
-- Create product_batches table
CREATE TABLE public.product_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  manufacturing_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  batch_cost_per_strip NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_product_batch_number UNIQUE (product_id, batch_number),
  CONSTRAINT valid_batch_status CHECK (status IN ('Active', 'Expired', 'Recalled', 'Quarantined')),
  CONSTRAINT positive_batch_cost CHECK (batch_cost_per_strip > 0 OR batch_cost_per_strip IS NULL)
);

-- Add updated_at trigger
CREATE TRIGGER update_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create validation function for date constraint
CREATE OR REPLACE FUNCTION validate_batch_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if expiry date is after manufacturing date
  IF NEW.expiry_date <= NEW.manufacturing_date THEN
    RAISE EXCEPTION 'Expiry date must be after manufacturing date';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add date validation trigger
CREATE TRIGGER validate_batch_dates_trigger
  BEFORE INSERT OR UPDATE ON public.product_batches
  FOR EACH ROW
  EXECUTE FUNCTION validate_batch_dates();

-- Create indexes for better query performance
CREATE INDEX idx_product_batches_product_id ON public.product_batches(product_id);
CREATE INDEX idx_product_batches_batch_number ON public.product_batches(product_id, batch_number);
CREATE INDEX idx_product_batches_status ON public.product_batches(status);
CREATE INDEX idx_product_batches_expiry_date ON public.product_batches(expiry_date);
