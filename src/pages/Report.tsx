import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, TrendingDown, AlertTriangle, DollarSign, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StockFilters from '@/components/report/StockFilters';
import StockTable, { 
  StockItem, 
  defaultStockColumns, 
  SortField, 
  SortDirection 
} from '@/components/report/StockTable';

const ITEMS_PER_PAGE = 50;

interface StockSummary {
  total_products: number;
  total_batches: number;
  total_value: number;
  low_stock_items: number;
  expiring_soon_items: number;
}

const ReportPage = () => {
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [batchFilter, setBatchFilter] = useState('');
  const [expiryFromDate, setExpiryFromDate] = useState('');
  const [expiryToDate, setExpiryToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultStockColumns);
  const [sortField, setSortField] = useState<SortField>('product_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // State for total count (for pagination)
  const [totalCount, setTotalCount] = useState(0);

  const handleColumnToggle = (columns: Record<string, boolean>) => {
    setVisibleColumns(columns);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    // Reset to first page when sorting changes
    setCurrentPage(1);
  };

  // Fetch stock data with server-side pagination, filtering, and sorting
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock-status', locationFilter, productFilter, categoryFilter, batchFilter, expiryFromDate, expiryToDate, currentPage, sortField, sortDirection],
    queryFn: async () => {
      try {
        // Build query for products_stock_status table with joins
        let query = supabase
          .from('products_stock_status')
          .select(`
            *,
            products:product_id (
              product_name,
              product_code,
              generic_name,
              min_stock_level_godown,
              min_stock_level_mr,
              product_categories (
                category_name
              )
            ),
            product_batches:batch_id (
              batch_number,
              expiry_date
            )
          `, { count: 'exact' });

        // Apply location filter
        if (locationFilter !== 'ALL') {
          if (locationFilter === 'GODOWN') {
            query = query.eq('location_type', 'GODOWN');
          } else if (locationFilter === 'MR') {
            query = query.eq('location_type', 'MR');
          } else if (locationFilter.startsWith('MR_')) {
            const mrId = locationFilter.replace('MR_', '');
            query = query.eq('location_type', 'MR').eq('location_id', mrId);
          }
        }

        // Apply product filter (search by name or code)
        if (productFilter) {
          query = query.or(`products.product_name.ilike.%${productFilter}%,products.product_code.ilike.%${productFilter}%`);
        }

        // Apply category filter
        if (categoryFilter && categoryFilter !== 'ALL') {
          query = query.eq('products.product_categories.category_name', categoryFilter);
        }

        // Apply batch filter
        if (batchFilter) {
          query = query.ilike('product_batches.batch_number', `%${batchFilter}%`);
        }

        // Apply expiry date range filter
        if (expiryFromDate && expiryToDate) {
          query = query
            .gte('product_batches.expiry_date', expiryFromDate)
            .lte('product_batches.expiry_date', expiryToDate);
        }

        // Filter out zero or negative stock
        query = query.gt('current_quantity_strips', 0);

        // Get total count before applying pagination
        const { count } = await query.count();
        setTotalCount(count || 0);

        // Apply sorting
        query = query.order(sortField, { ascending: sortDirection === 'asc' });

        // Apply pagination
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        // Execute the query
        const { data, error } = await query;
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }

        // Map the data to the StockItem interface
        const stockItems: StockItem[] = data.map(item => {
          const product = item.products;
          const batch = item.product_batches;
          
          return {
            product_id: item.product_id,
            product_name: product?.product_name || '',
            product_code: product?.product_code || '',
            generic_name: product?.generic_name || '',
            batch_id: item.batch_id,
            batch_number: batch?.batch_number || '',
            expiry_date: batch?.expiry_date || '',
            location_type: item.location_type,
            location_id: item.location_id,
            current_quantity_strips: item.current_quantity_strips,
            cost_per_strip: item.cost_per_strip,
            total_value: item.current_quantity_strips * item.cost_per_strip,
            category_name: product?.product_categories?.category_name,
            min_stock_level_godown: product?.min_stock_level_godown || 0,
            min_stock_level_mr: product?.min_stock_level_mr || 0,
          };
        });
        
        return stockItems;
      } catch (error) {
        console.error('Error fetching stock data:', error);
        throw error;
      }
    },
  });

  // Fetch summary data with server-side aggregation
  const { data: summaryData } = useQuery({
    queryKey: ['stock-summary', locationFilter, productFilter, categoryFilter, batchFilter, expiryFromDate, expiryToDate],
    queryFn: async () => {
      try {
        // Build base query with the same filters as the main query
        let query = supabase
          .from('products_stock_status')
          .select(`
            product_id,
            batch_id,
            current_quantity_strips,
            cost_per_strip,
            location_type,
            products:product_id (
              min_stock_level_godown,
              min_stock_level_mr
            ),
            product_batches:batch_id (
              expiry_date
            )
          `);

        // Apply the same filters as the main query
        if (locationFilter !== 'ALL') {
          if (locationFilter === 'GODOWN') {
            query = query.eq('location_type', 'GODOWN');
          } else if (locationFilter === 'MR') {
            query = query.eq('location_type', 'MR');
          } else if (locationFilter.startsWith('MR_')) {
            const mrId = locationFilter.replace('MR_', '');
            query = query.eq('location_type', 'MR').eq('location_id', mrId);
          }
        }

        if (productFilter) {
          query = query.or(`products.product_name.ilike.%${productFilter}%,products.product_code.ilike.%${productFilter}%`);
        }

        if (categoryFilter && categoryFilter !== 'ALL') {
          query = query.eq('products.product_categories.category_name', categoryFilter);
        }

        if (batchFilter) {
          query = query.ilike('product_batches.batch_number', `%${batchFilter}%`);
        }

        if (expiryFromDate && expiryToDate) {
          query = query
            .gte('product_batches.expiry_date', expiryFromDate)
            .lte('product_batches.expiry_date', expiryToDate);
        }

        // Filter out zero or negative stock
        query = query.gt('current_quantity_strips', 0);

        // Execute the query
        const { data, error } = await query;
        
        if (error) {
          console.error('Supabase summary query error:', error);
          throw error;
        }

        // Calculate summary statistics
        const uniqueProducts = new Set(data.map(item => item.product_id));
        const uniqueBatches = new Set(data.map(item => item.batch_id));
        const totalValue = data.reduce((sum, item) => sum + (item.current_quantity_strips * item.cost_per_strip), 0);

        // Calculate items with low stock
        const lowStockItems = data.filter(item => {
          const minLevel = item.location_type === 'GODOWN' 
            ? item.products?.min_stock_level_godown || 0
            : item.products?.min_stock_level_mr || 0;
          return item.current_quantity_strips <= minLevel;
        }).length;

        // Calculate items expiring in next 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const expiringSoonItems = data.filter(item => {
          if (!item.product_batches?.expiry_date) return false;
          const expiryDate = new Date(item.product_batches.expiry_date);
          return expiryDate <= thirtyDaysFromNow;
        }).length;

        return {
          total_products: uniqueProducts.size,
          total_batches: uniqueBatches.size,
          total_value: totalValue,
          low_stock_items: lowStockItems,
          expiring_soon_items: expiringSoonItems,
        };
      } catch (error) {
        console.error('Error fetching summary data:', error);
        return {
          total_products: 0,
          total_batches: 0,
          total_value: 0,
          low_stock_items: 0,
          expiring_soon_items: 0,
        };
      }
    },
  });

  // Fetch categories for filter (this can remain as is)
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('category_name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch MR users for location filter
  const { data: mrUsers } = useQuery({
    queryKey: ['mr-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('role', 'user');
      if (error) throw error;
      return data;
    },
  });

  // Use the summary data from the server
  const summary: StockSummary = summaryData || {
    total_products: 0,
    total_batches: 0,
    total_value: 0,
    low_stock_items: 0,
    expiring_soon_items: 0
  };

  const handleClearFilters = () => {
    setProductFilter('');
    setCategoryFilter('ALL');
    setBatchFilter('');
    setExpiryFromDate('');
    setExpiryToDate('');
  };

  if (isLoading) {
    return (
      <div className="w-full p-6">
        <div className="text-center">Loading stock data...</div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Real-time Stock Status</h1>
          <p className="text-gray-600">Monitor and manage your stock levels across all locations</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border">
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 px-3 rounded-full"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Show Summary
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl rounded-lg p-6 shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">Stock Summary</DialogTitle>
                  <DialogDescription className="text-sm text-gray-600">
                    Summary of stock status details
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold">{summary.total_products}</div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold">{summary.total_batches}</div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold">₹{summary.total_value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}</div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                      <TrendingDown className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold text-red-600">{summary.low_stock_items}</div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold text-orange-600">{summary.expiring_soon_items}</div>
                    </CardContent>
                  </Card>
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearFilters}
              className="h-8 px-3 rounded-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Component */}
      <StockFilters
        locationFilter={locationFilter}
        setLocationFilter={setLocationFilter}
        productFilter={productFilter}
        setProductFilter={setProductFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        batchFilter={batchFilter}
        setBatchFilter={setBatchFilter}
        expiryFromDate={expiryFromDate}
        setExpiryFromDate={setExpiryFromDate}
        expiryToDate={expiryToDate}
        setExpiryToDate={setExpiryToDate}
        categories={categories}
        mrUsers={mrUsers}
        onClearFilters={handleClearFilters}
      />

      {/* Stock Table Component */}
      <StockTable
        stockData={stockData}
        isLoading={isLoading}
        totalCount={totalCount}
        itemsPerPage={ITEMS_PER_PAGE}
        visibleColumns={visibleColumns}
        onColumnToggle={handleColumnToggle}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />

      {/* Alerts for low stock and expiring items */}
      {summary.low_stock_items > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have {summary.low_stock_items} items with low stock levels. Consider restocking soon.
          </AlertDescription>
        </Alert>
      )}

      {summary.expiring_soon_items > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have {summary.expiring_soon_items} items expiring within 30 days. Review and take action.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ReportPage;