-- Rollback migration for 014closing_stock.sql
-- This script will drop all changes made by the closing_stock migration

-- Drop triggers first (to avoid dependency issues)
DROP TRIGGER IF EXISTS update_closing_stock_purchases_trigger ON public.stock_purchases;
DROP TRIGGER IF EXISTS update_closing_stock_sales_trigger ON public.stock_sales;
DROP TRIGGER IF EXISTS update_closing_stock_adjustments_trigger ON public.stock_adjustments;

-- Drop functions
DROP FUNCTION IF EXISTS update_closing_stock();
DROP FUNCTION IF EXISTS populate_initial_closing_stock();

-- Drop views
DROP VIEW IF EXISTS public.closing_stock_view;
DROP VIEW IF EXISTS public.closing_stock_report_view;

-- Drop indexes (they will be dropped automatically with the table, but explicit for clarity)
DROP INDEX IF EXISTS public.idx_closing_stock_product_id;
DROP INDEX IF EXISTS public.idx_closing_stock_batch_id;
DROP INDEX IF EXISTS public.idx_closing_stock_location;

-- Drop the main tables (with CASCADE to handle any remaining dependencies)
DROP TABLE IF EXISTS public.closing_stock CASCADE;
DROP TABLE IF EXISTS public.closing_stock_report CASCADE;

-- Confirmation message
SELECT 'Closing stock migration has been successfully rolled back' AS rollback_status;