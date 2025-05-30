
-- Create product_sub_categories table first (since products references it)
CREATE TABLE public.product_sub_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_category_name TEXT NOT NULL,
  category_id UUID REFERENCES public.product_categories(id) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sub_category_name, category_id)
);

-- Now create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  category_id UUID REFERENCES public.product_categories(id) NOT NULL,
  sub_category_id UUID REFERENCES public.product_sub_categories(id),
  formulation_id UUID REFERENCES public.product_formulations(id) NOT NULL,
  unit_of_measure_smallest TEXT NOT NULL DEFAULT 'Strip',
  base_cost_per_strip DECIMAL(10,2) NOT NULL CHECK (base_cost_per_strip >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  storage_conditions TEXT,
  image_url TEXT,
  min_stock_level_godown INTEGER DEFAULT 0 CHECK (min_stock_level_godown >= 0),
  min_stock_level_mr INTEGER DEFAULT 0 CHECK (min_stock_level_mr >= 0),
  lead_time_days INTEGER DEFAULT 0 CHECK (lead_time_days >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS) for product_sub_categories
ALTER TABLE public.product_sub_categories ENABLE ROW LEVEL SECURITY;

-- Create policy for admins - full access to product_sub_categories
CREATE POLICY "Admins can do everything on product_sub_categories" 
  ON public.product_sub_categories 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create policy for workers - read only for product_sub_categories
CREATE POLICY "Workers can view product_sub_categories" 
  ON public.product_sub_categories 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'user')
    )
  );

-- Add Row Level Security (RLS) for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policy for admins - full access to products
CREATE POLICY "Admins can do everything on products" 
  ON public.products 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create policy for workers - read only for products
CREATE POLICY "Workers can view products" 
  ON public.products 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'user')
    )
  );

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_product_sub_categories_updated_at 
  BEFORE UPDATE ON public.product_sub_categories 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON public.products 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_product_sub_categories_category_id ON public.product_sub_categories(category_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_sub_category_id ON public.products(sub_category_id);
CREATE INDEX idx_products_formulation_id ON public.products(formulation_id);
CREATE INDEX idx_products_product_code ON public.products(product_code);
CREATE INDEX idx_products_is_active ON public.products(is_active);
