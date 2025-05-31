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

  // Fetch total count for pagination
  const { data: countData } = useQuery({
    queryKey: ['stock-status-count', locationFilter, productFilter, categoryFilter, batchFilter, expiryFromDate, expiryToDate],
    queryFn: async () => {
      try {
        let query = supabase
          .from('products_stock_status')
          .select('id', { count: 'exact', head: true })
          .gt('current_quantity_strips', 0);

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

        // Apply product filter
        if (productFilter) {
          // First get product IDs that match the filter
          const { data: productIds } = await supabase
            .from('products')
            .select('id')
            .or(`product_name.ilike.%${productFilter}%,product_code.ilike.%${productFilter}%,generic_name.ilike.%${productFilter}%`);
          
          if (productIds && productIds.length > 0) {
            query = query.in('product_id', productIds.map(p => p.id));
          } else {
            return { count: 0 };
          }
        }

        // Apply category filter
        if (categoryFilter && categoryFilter !== 'ALL') {
          // First get product IDs in this category
          const { data: productIds } = await supabase
            .from('products')
            .select('id')
            .eq('product_categories.category_name', categoryFilter)
            .select('id');
          
          if (productIds && productIds.length > 0) {
            query = query.in('product_id', productIds.map(p => p.id));
          } else {
            return { count: 0 };
          }
        }

        // Apply batch filter
        if (batchFilter) {
          // First get batch IDs that match the filter
          const { data: batchIds } = await supabase
            .from('product_batches')
            .select('id')
            .ilike('batch_number', `%${batchFilter}%`);
          
          if (batchIds && batchIds.length > 0) {
            query = query.in('batch_id', batchIds.map(b => b.id));
          } else {
            return { count: 0 };
          }
        }

        // Apply expiry date filter
        if (expiryFromDate && expiryToDate) {
          // First get batch IDs in the date range
          const { data: batchIds } = await supabase
            .from('product_batches')
            .select('id')
            .gte('expiry_date', expiryFromDate)
            .lte('expiry_date', expiryToDate);
          
          if (batchIds && batchIds.length > 0) {
            query = query.in('batch_id', batchIds.map(b => b.id));
          } else {
            return { count: 0 };
          }
        }

        const { count, error } = await query;
        
        if (error) throw error;
        return { count: count || 0 };
      } catch (error) {
        console.error('Error fetching count:', error);
        return { count: 0 };
      }
    },
    keepPreviousData: true,
  });

  useEffect(() => {
    if (countData) {
      setTotalCount(countData.count);
    }
  }, [countData]);

  // Fetch stock data with server-side pagination, filtering, and sorting
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock-status', locationFilter, productFilter, categoryFilter, batchFilter, expiryFromDate, expiryToDate, currentPage, sortField, sortDirection],
    queryFn: async () => {
      try {
        // Calculate range for pagination
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        // Start building the query with joins to get all required data
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
              product_categories:category_id (
                category_name
              )
            ),
            product_batches:batch_id (
              batch_number,
              expiry_date
            )
          `)
          .gt('current_quantity_strips', 0);

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

        // Apply product filter
        if (productFilter) {
          // First get product IDs that match the filter
          const { data: productIds } = await supabase
            .from('products')
            .select('id')
            .or(`product_name.ilike.%${productFilter}%,product_code.ilike.%${productFilter}%,generic_name.ilike.%${productFilter}%`);
          
          if (productIds && productIds.length > 0) {
            query = query.in('product_id', productIds.map(p => p.id));
          } else {
            return [];
          }
        }

        // Apply category filter
        if (categoryFilter && categoryFilter !== 'ALL') {
          // First get product IDs in this category
          const { data: productIds } = await supabase
            .from('products')
            .select('id, product_categories!inner(category_name)')
            .eq('product_categories.category_name', categoryFilter);
          
          if (productIds && productIds.length > 0) {
            query = query.in('product_id', productIds.map(p => p.id));
          } else {
            return [];
          }
        }

        // Apply batch filter
        if (batchFilter) {
          // First get batch IDs that match the filter
          const { data: batchIds } = await supabase
            .from('product_batches')
            .select('id')
            .ilike('batch_number', `%${batchFilter}%`);
          
          if (batchIds && batchIds.length > 0) {
            query = query.in('batch_id', batchIds.map(b => b.id));
          } else {
            return [];
          }
        }

        // Apply expiry date filter
        if (expiryFromDate && expiryToDate) {
          // First get batch IDs in the date range
          const { data: batchIds } = await supabase
            .from('product_batches')
            .select('id')
            .gte('expiry_date', expiryFromDate)
            .lte('expiry_date', expiryToDate);
          
          if (batchIds && batchIds.length > 0) {
            query = query.in('batch_id', batchIds.map(b => b.id));
          } else {
            return [];
          }
        }

        // Apply sorting
        if (sortField === 'product_name') {
          query = query.order('products(product_name)', { ascending: sortDirection === 'asc' });
        } else if (sortField === 'generic_name') {
          query = query.order('products(generic_name)', { ascending: sortDirection === 'asc' });
        } else if (sortField === 'batch_number') {
          query = query.order('product_batches(batch_number)', { ascending: sortDirection === 'asc' });
        } else if (sortField === 'expiry_date') {
          query = query.order('product_batches(expiry_date)', { ascending: sortDirection === 'asc' });
        } else {
          // For other fields that are directly in the products_stock_status table
          query = query.order(sortField, { ascending: sortDirection === 'asc' });
        }

        // Apply pagination
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }

        // Transform the data to match the StockItem interface
        const transformedData: StockItem[] = data.map(item => ({
          product_id: item.product_id,
          product_name: item.products?.product_name || '',
          product_code: item.products?.product_code || '',
          generic_name: item.products?.generic_name || '',
          batch_id: item.batch_id,
          batch_number: item.product_batches?.batch_number || '',
          expiry_date: item.product_batches?.expiry_date || '',
          location_type: item.location_type,
          location_id: item.location_id,
          current_quantity_strips: item.current_quantity_strips,
          cost_per_strip: item.cost_per_strip,
          total_value: item.total_value || 0,
          category_name: item.products?.product_categories?.category_name,
          min_stock_level_godown: item.products?.min_stock_level_godown,
          min_stock_level_mr: item.products?.min_stock_level_mr,
        }));

        return transformedData;
      } catch (error) {
        console.error('Error fetching stock data:', error);
        throw error;
      }
    },
    keepPreviousData: true,
  });

  // Fetch summary data
  const { data: summaryData } = useQuery({
    queryKey: ['stock-summary', locationFilter, productFilter, categoryFilter, batchFilter, expiryFromDate, expiryToDate],
    queryFn: async () => {
      try {
        // Get total products count
        const { data: productsCount, error: productsError } = await supabase
          .from('products_stock_status')
          .select('product_id', { count: 'exact', head: true })
          .gt('current_quantity_strips', 0);
        
        if (productsError) throw productsError;
        
        // Get total batches count
        const { data: batchesCount, error: batchesError } = await supabase
          .from('products_stock_status')
          .select('batch_id', { count: 'exact', head: true })
          .gt('current_quantity_strips', 0);
        
        if (batchesError) throw batchesError;
        
        // Get total value
        const { data: valueData, error: valueError } = await supabase
          .from('products_stock_status')
          .select('total_value')
          .gt('current_quantity_strips', 0);
        
        if (valueError) throw valueError;
        
        const totalValue = valueData?.reduce((sum, item) => sum + (item.total_value || 0), 0) || 0;
        
        // Get low stock items count
        const { data: lowStockData, error: lowStockError } = await supabase.rpc('get_low_stock_items_count');
        
        if (lowStockError) {
          console.error('Error fetching low stock count:', lowStockError);
          // Fallback calculation if RPC fails
          const lowStockCount = 0; // We'll need a more complex query to calculate this
        }
        
        // Get expiring soon items count
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0];
        
        const { data: expiringData, error: expiringError } = await supabase
          .from('products_stock_status')
          .select('id', { count: 'exact', head: true })
          .gt('current_quantity_strips', 0)
          .lte('product_batches.expiry_date', thirtyDaysFromNowStr);
        
        if (expiringError) throw expiringError;
        
        return {
          total_products: productsCount?.count || 0,
          total_batches: batchesCount?.count || 0,
          total_value: totalValue,
          low_stock_items: lowStockData?.count || 0,
          expiring_soon_items: expiringData?.count || 0,
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
    keepPreviousData: true,
  });

  // Fetch categories for filter
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

  const handleClearFilters = () => {
    setProductFilter('');
    setCategoryFilter('ALL');
    setBatchFilter('');
    setExpiryFromDate('');
    setExpiryToDate('');
    setLocationFilter('ALL');
    setCurrentPage(1);
  };

  if (isLoading && !stockData) {
    return (
      <div className="w-full p-6">
        <div className="text-center">Loading stock data...</div>
      </div>
    );
  }

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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
                      <div className="text-3xl font-extrabold">{summaryData?.total_products || 0}</div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold">{summaryData?.total_batches || 0}</div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold">₹{(summaryData?.total_value || 0).toFixed(2)}</div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                      <TrendingDown className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold text-red-600">{summaryData?.low_stock_items || 0}</div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-lg shadow-sm border border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold text-orange-600">{summaryData?.expiring_soon_items || 0}</div>
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
        batchFilter={setBatchFilter}
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
        stockData={stockData || []}
        isLoading={isLoading}
        visibleColumns={visibleColumns}
        onColumnToggle={handleColumnToggle}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        itemsPerPage={ITEMS_PER_PAGE}
        totalPages={totalPages}
      />

      {/* Alerts for low stock and expiring items */}
      {(summaryData?.low_stock_items || 0) > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have {summaryData?.low_stock_items} items with low stock levels. Consider restocking soon.
          </AlertDescription>
        </Alert>
      )}

      {(summaryData?.expiring_soon_items || 0) > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have {summaryData?.expiring_soon_items} items expiring within 30 days. Review and take action.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ReportPage;