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
import { calculateStockData, calculateStockSummary } from '@/lib/stockCalculations';
import { StockSummary, StockFilters as StockFiltersType } from '@/types/stock';

const ITEMS_PER_PAGE = 20;



const ReportPage = () => {
  const [filters, setFilters] = useState<StockFiltersType>({
    locationFilter: 'ALL',
    productFilter: '',
    categoryFilter: 'ALL',
    batchFilter: '',
    expiryFromDate: '',
    expiryToDate: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultStockColumns);
  const [sortConfig, setSortConfig] = useState<{ key: SortField; direction: SortDirection }>({
    key: 'product_name',
    direction: 'asc'
  });

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      key: field,
      direction: prev.key === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleColumnToggle = (columns: Record<string, boolean>) => {
    setVisibleColumns(columns);
  };

  // Fetch stock data using the calculation service
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock-status', filters.locationFilter, filters.productFilter, filters.categoryFilter, filters.batchFilter, filters.expiryFromDate, filters.expiryToDate],
    queryFn: () => calculateStockData(filters),
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

  // Calculate summary data using the service
  const summary: StockSummary = React.useMemo(() => {
    return calculateStockSummary(stockData || []);
  }, [stockData]);

  const handleClearFilters = () => {
    setFilters({
      locationFilter: 'ALL',
      productFilter: '',
      categoryFilter: 'ALL',
      batchFilter: '',
      expiryFromDate: '',
      expiryToDate: ''
    });
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
        locationFilter={filters.locationFilter}
        setLocationFilter={(value) => setFilters(prev => ({ ...prev, locationFilter: value }))}
        productFilter={filters.productFilter}
        setProductFilter={(value) => setFilters(prev => ({ ...prev, productFilter: value }))}
        categoryFilter={filters.categoryFilter}
        setCategoryFilter={(value) => setFilters(prev => ({ ...prev, categoryFilter: value }))}
        batchFilter={filters.batchFilter}
        setBatchFilter={(value) => setFilters(prev => ({ ...prev, batchFilter: value }))}
        expiryFromDate={filters.expiryFromDate}
        setExpiryFromDate={(value) => setFilters(prev => ({ ...prev, expiryFromDate: value }))}
        expiryToDate={filters.expiryToDate}
        setExpiryToDate={(value) => setFilters(prev => ({ ...prev, expiryToDate: value }))}
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
        sortField={sortConfig.key}
        sortDirection={sortConfig.direction}
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
