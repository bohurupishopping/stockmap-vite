
-- Create product_formulations table
CREATE TABLE public.product_formulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formulation_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.product_formulations ENABLE ROW LEVEL SECURITY;

-- Create policy for admins - full access
CREATE POLICY "Admins can do everything on product_formulations" 
  ON public.product_formulations 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create policy for workers - read only
CREATE POLICY "Workers can view product_formulations" 
  ON public.product_formulations 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'user')
    )
  );

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_product_formulations_updated_at 
  BEFORE UPDATE ON public.product_formulations 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
