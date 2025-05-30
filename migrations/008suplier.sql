
-- Create suppliers table for stock receipts
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  supplier_code TEXT UNIQUE,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add trigger for updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS for suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for suppliers (admin full access, users read-only)
CREATE POLICY "Admin can manage suppliers" 
  ON public.suppliers 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view active suppliers" 
  ON public.suppliers 
  FOR SELECT 
  USING (
    is_active = true AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Add some sample suppliers
INSERT INTO public.suppliers (supplier_name, supplier_code, contact_person, phone, email) VALUES
  ('MediPharma Ltd', 'MED001', 'John Smith', '+91-9876543210', 'john@medipharma.com'),
  ('Global Healthcare', 'GLB001', 'Sarah Johnson', '+91-9876543211', 'sarah@globalhc.com'),
  ('Pharma Solutions', 'PHA001', 'Mike Wilson', '+91-9876543212', 'mike@pharmasol.com');
