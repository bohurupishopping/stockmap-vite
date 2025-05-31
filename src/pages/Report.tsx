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

const ITEMS_PER_PAGE = 20;

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

  // Fetch stock data from the new closing_stock_view
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['closing-stock', locationFilter, productFilter, categoryFilter, batchFilter, expiryFromDate, expiryToDate],
    queryFn: async () => {
      try {
        // Build query for closing_stock_view
        let query = supabase
          .from('closing_stock_view')
          .select('*');

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
          query = query.or(`product_code.ilike.%${productFilter}%,product_name.ilike.%${productFilter}%`);
        }

        // Apply category filter
        if (categoryFilter !== 'ALL') {
          query = query.eq('category_name', categoryFilter);
        }

        // Apply batch filter
        if (batchFilter) {
          query = query.ilike('batch_number', `%${batchFilter}%`);
        }

        // Apply expiry date filter
        if (expiryFromDate && expiryToDate) {
          query = query
            .gte('expiry_date', expiryFromDate)
            .lte('expiry_date', expiryToDate);
        }

        // Only show items with positive quantity
        query = query.gt('quantity_strips', 0);

        const { data, error } = await query;
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        
        // Map the data to match the StockItem interface
        const stockItems: StockItem[] = data.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          generic_name: item.generic_name,
          batch_id: item.batch_id,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          location_type: item.location_type,
          location_id: item.location_id,
          current_quantity_strips: item.quantity_strips,
          cost_per_strip: item.cost_per_strip,
          total_value: item.total_value,
          category_name: item.category_name,
          min_stock_level_godown: item.min_stock_level_godown,
          min_stock_level_mr: item.min_stock_level_mr
        }));
        
        return stockItems;
      } catch (error) {
        console.error('Error fetching stock data:', error);
        throw error;
      }
    },
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

  // Calculate summary data
  const summary: StockSummary = React.useMemo(() => {
    if (!stockData) return { total_products: 0, total_batches: 0, total_value: 0, low_stock_items: 0, expiring_soon_items: 0 };

    const uniqueProducts = new Set(stockData.map(item => item.product_id));
    const uniqueBatches = new Set(stockData.map(item => item.batch_id));
    const totalValue = stockData.reduce((sum, item) => sum + item.total_value, 0);

    // Calculate items with low stock
    const lowStockItems = stockData.filter(item => {
      const minLevel = item.location_type === 'GODOWN' 
        ? item.min_stock_level_godown || 0
        : item.min_stock_level_mr || 0;
      return item.current_quantity_strips <= minLevel;
    }).length;

    // Calculate items expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoonItems = stockData.filter(item => {
      const expiryDate = new Date(item.expiry_date);
      return expiryDate <= thirtyDaysFromNow;
    }).length;

    return {
      total_products: uniqueProducts.size,
      total_batches: uniqueBatches.size,
      total_value: totalValue,
      low_stock_items: lowStockItems,
      expiring_soon_items: expiringSoonItems,
    };
  }, [stockData]);

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
                      <div className="text-3xl font-extrabold">₹{summary.total_value.toFixed(2)}</div>
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
        visibleColumns={visibleColumns}
        onColumnToggle={handleColumnToggle}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        itemsPerPage={ITEMS_PER_PAGE}
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
