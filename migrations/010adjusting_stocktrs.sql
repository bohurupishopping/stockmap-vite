
-- Add the missing updated_at column to stock_transactions table
ALTER TABLE public.stock_transactions 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Add trigger to update the updated_at timestamp
CREATE TRIGGER update_stock_transactions_updated_at
  BEFORE UPDATE ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
