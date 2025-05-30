import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, TrendingDown, AlertTriangle, DollarSign, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ProductTableColumns from '@/components/products/ProductTableColumns';
import StockFilters from '@/components/report/StockFilters';
import StockTable, { 
  StockItem, 
  StockColumnConfig, 
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

  // Fetch stock data with proper calculation
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock-status', locationFilter, productFilter, categoryFilter, batchFilter, expiryFromDate, expiryToDate],
    queryFn: async () => {
      console.log('Fetching stock data with filters:', {
        locationFilter,
        productFilter,
        categoryFilter,
        batchFilter,
        expiryFromDate,
        expiryToDate
      });

      try {
        // First, fetch all products for later lookup
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select(`
            id,
            product_name,
            product_code,
            generic_name,
            min_stock_level_godown,
            min_stock_level_mr,
            product_categories (
              category_name
            )
          `);
        
        if (productsError) {
          console.error('Error fetching products:', productsError);
          throw productsError;
        }
        
        // Create a map of products for quick lookup
        const productMap = new Map();
        products?.forEach(product => {
          productMap.set(product.id, product);
        });
        
        // Fetch all batches for later lookup
        const { data: batches, error: batchesError } = await supabase
          .from('product_batches')
          .select(`
            id,
            batch_number,
            expiry_date
          `);
        
        if (batchesError) {
          console.error('Error fetching batches:', batchesError);
          throw batchesError;
        }
        
        // Create a map of batches for quick lookup
        const batchMap = new Map();
        batches?.forEach(batch => {
          batchMap.set(batch.id, batch);
        });

        // Build query for transactions
        let query = supabase
          .from('stock_transactions_view')
          .select(`
            product_id,
            batch_id,
            transaction_type,
            quantity_strips,
            location_type_source,
            location_id_source,
            location_type_destination,
            location_id_destination,
            cost_per_strip_at_transaction,
            transaction_date
          `);

        // Apply filters
        if (productFilter) {
          console.log('Applying product filter:', productFilter);
          // Get product IDs that match the filter
          const filteredProductIds = products
            ?.filter(p => 
              p.product_name.toLowerCase().includes(productFilter.toLowerCase()) || 
              p.product_code.toLowerCase().includes(productFilter.toLowerCase())
            )
            .map(p => p.id);
          
          if (filteredProductIds && filteredProductIds.length > 0) {
            query = query.in('product_id', filteredProductIds);
          } else {
            // No products match the filter, return empty result
            return [];
          }
        }

        if (batchFilter) {
          console.log('Applying batch filter:', batchFilter);
          // Get batch IDs that match the filter
          const filteredBatchIds = batches
            ?.filter(b => b.batch_number.toLowerCase().includes(batchFilter.toLowerCase()))
            .map(b => b.id);
          
          if (filteredBatchIds && filteredBatchIds.length > 0) {
            query = query.in('batch_id', filteredBatchIds);
          } else {
            // No batches match the filter, return empty result
            return [];
          }
        }

        if (expiryFromDate && expiryToDate) {
          console.log('Applying expiry date range filter:', expiryFromDate, 'to', expiryToDate);
          // Get batch IDs that match the expiry date range
          const filteredBatchIds = batches
            ?.filter(b => {
              const expiryDate = new Date(b.expiry_date);
              const fromDate = new Date(expiryFromDate);
              const toDate = new Date(expiryToDate);
              return expiryDate >= fromDate && expiryDate <= toDate;
            })
            .map(b => b.id);
          
          if (filteredBatchIds && filteredBatchIds.length > 0) {
            query = query.in('batch_id', filteredBatchIds);
          } else {
            // No batches match the filter, return empty result
            return [];
          }
        }

        console.log('Executing query...');
        const { data: transactions, error } = await query;
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        
        console.log(`Query returned ${transactions?.length || 0} transactions`);
        if (transactions && transactions.length > 0) {
          console.log('Sample transaction:', transactions[0]);
        }

        // Apply category filter if needed
        let filteredData = transactions || [];
        if (categoryFilter && categoryFilter !== 'ALL') {
          console.log('Applying category filter in memory:', categoryFilter);
          filteredData = filteredData.filter(tx => {
            const product = productMap.get(tx.product_id);
            if (!product || !product.product_categories) return false;
            
            // Handle both array and object responses from Supabase
            const categories = Array.isArray(product.product_categories) 
              ? product.product_categories 
              : [product.product_categories];
            
            return categories.some((cat: any) => cat.category_name === categoryFilter);
          });
          console.log(`After category filtering: ${filteredData.length} transactions`);
        }

        // Calculate actual stock by processing all transactions
        const stockMap = new Map<string, StockItem>();

        filteredData.forEach((transaction: any) => {
          try {
            // Get product and batch data from our maps
            const product = productMap.get(transaction.product_id);
            const batch = batchMap.get(transaction.batch_id);
            
            // Skip transactions with missing related data
            if (!product || !batch) {
              console.log('Skipping transaction with missing related data:', transaction);
              return;
            }
            
            // Helper function to get or create a stock item entry
            const getOrCreateStockItem = (productId: string, batchId: string, locationType: string, locationId: string) => {
              const key = `${productId}_${batchId}_${locationType}_${locationId}`;
              
              if (!stockMap.has(key)) {
                // Handle both array and object responses from Supabase
                const categories = Array.isArray(product.product_categories) 
                  ? product.product_categories 
                  : product.product_categories ? [product.product_categories] : [];
                
                stockMap.set(key, {
                  product_id: productId,
                  product_name: product.product_name,
                  product_code: product.product_code,
                  generic_name: product.generic_name,
                  batch_id: batchId,
                  batch_number: batch.batch_number,
                  expiry_date: batch.expiry_date,
                  location_type: locationType,
                  location_id: locationId,
                  current_quantity_strips: 0,
                  cost_per_strip: transaction.cost_per_strip_at_transaction,
                  total_value: 0,
                  category_name: categories[0]?.category_name,
                  min_stock_level_godown: product.min_stock_level_godown,
                  min_stock_level_mr: product.min_stock_level_mr,
                });
              }
              
              return stockMap.get(key)!;
            };
            
            // Process based on transaction type
            const txType = transaction.transaction_type;
            
            // Determine the location and direction of stock movement
            let stockLocation: string | null = null;
            let stockLocationId: string | null = null;
            let quantityChange = 0;
            
            // Process based on transaction type to determine the correct stock location and quantity change
            if (txType === 'STOCK_IN_GODOWN') {
              // Stock coming into godown (positive)
              stockLocation = 'GODOWN';
              stockLocationId = '';
              quantityChange = transaction.quantity_strips; // Positive for inflow
            }
            else if (txType === 'DISPATCH_TO_MR') {
              // For dispatch, we have two effects:
              // 1. Decrease in godown stock
              if (transaction.location_type_source === 'GODOWN') {
                // Only process if we're interested in godown or all locations
                if (locationFilter === 'ALL' || locationFilter === 'GODOWN') {
                  const godownItem = getOrCreateStockItem(
                    transaction.product_id,
                    transaction.batch_id,
                    'GODOWN',
                    ''
                  );
                  godownItem.current_quantity_strips -= transaction.quantity_strips;
                }
              }
              
              // 2. Increase in MR stock
              if (transaction.location_type_destination === 'MR' && transaction.location_id_destination) {
                // Only process if we're interested in this MR or all MRs or all locations
                const mrId = transaction.location_id_destination;
                if (locationFilter === 'ALL' || 
                    locationFilter === 'MR' || 
                    (locationFilter.startsWith('MR_') && locationFilter.replace('MR_', '') === mrId)) {
                  const mrItem = getOrCreateStockItem(
                    transaction.product_id,
                    transaction.batch_id,
                    'MR',
                    mrId
                  );
                  mrItem.current_quantity_strips += transaction.quantity_strips;
                  mrItem.cost_per_strip = transaction.cost_per_strip_at_transaction;
                }
              }
              
              // Skip the default processing since we've handled both sides
              return;
            }
            else if (txType === 'SALE_DIRECT_GODOWN') {
              // Sale directly from godown (negative for godown)
              if (transaction.location_type_source === 'GODOWN') {
                stockLocation = 'GODOWN';
                stockLocationId = '';
                quantityChange = -transaction.quantity_strips; // Negative for outflow
              }
            }
            else if (txType === 'SALE_BY_MR') {
              // Sale by MR (negative for MR)
              if (transaction.location_type_source === 'MR' && transaction.location_id_source) {
                stockLocation = 'MR';
                stockLocationId = transaction.location_id_source;
                quantityChange = -transaction.quantity_strips; // Negative for outflow
              }
            }
            else if (txType.includes('RETURN_TO_GODOWN')) {
              // Return to godown (positive for godown, negative for source if MR)
              if (transaction.location_type_destination === 'GODOWN') {
                // Add to godown
                if (locationFilter === 'ALL' || locationFilter === 'GODOWN') {
                  const godownItem = getOrCreateStockItem(
                    transaction.product_id,
                    transaction.batch_id,
                    'GODOWN',
                    ''
                  );
                  godownItem.current_quantity_strips += transaction.quantity_strips;
                  godownItem.cost_per_strip = transaction.cost_per_strip_at_transaction;
                }
              }
              
              // Remove from MR if that's the source
              if (transaction.location_type_source === 'MR' && transaction.location_id_source) {
                const mrId = transaction.location_id_source;
                if (locationFilter === 'ALL' || 
                    locationFilter === 'MR' || 
                    (locationFilter.startsWith('MR_') && locationFilter.replace('MR_', '') === mrId)) {
                  const mrItem = getOrCreateStockItem(
                    transaction.product_id,
                    transaction.batch_id,
                    'MR',
                    mrId
                  );
                  mrItem.current_quantity_strips -= transaction.quantity_strips;
                }
              }
              
              // Skip default processing
              return;
            }
            else if (txType.includes('ADJUST_DAMAGE_') || 
                     txType.includes('ADJUST_LOSS_') || 
                     txType.includes('ADJUST_EXPIRED_')) {
              // Adjustments for damage/loss/expiry (negative)
              if (txType.includes('_GODOWN')) {
                stockLocation = 'GODOWN';
                stockLocationId = '';
              } else if (txType.includes('_MR') && transaction.location_id_source) {
                stockLocation = 'MR';
                stockLocationId = transaction.location_id_source;
              }
              
              if (stockLocation) {
                quantityChange = -transaction.quantity_strips; // Negative for outflow
              }
            }
            else if (txType.includes('OPENING_STOCK_')) {
              // Opening stock (positive)
              if (txType.includes('OPENING_STOCK_GODOWN')) {
                stockLocation = 'GODOWN';
                stockLocationId = '';
              } else if (txType.includes('OPENING_STOCK_MR') && transaction.location_id_destination) {
                stockLocation = 'MR';
                stockLocationId = transaction.location_id_destination;
              }
              
              if (stockLocation) {
                quantityChange = transaction.quantity_strips; // Positive for inflow
              }
            }
            else if (txType.includes('REPLACEMENT_')) {
              // Handle replacements
              if (txType.includes('REPLACEMENT_FROM_GODOWN')) {
                // Outflow from godown
                if (locationFilter === 'ALL' || locationFilter === 'GODOWN') {
                  const godownItem = getOrCreateStockItem(
                    transaction.product_id,
                    transaction.batch_id,
                    'GODOWN',
                    ''
                  );
                  godownItem.current_quantity_strips -= transaction.quantity_strips;
                }
              } 
              else if (txType.includes('REPLACEMENT_FROM_MR') && transaction.location_id_source) {
                // Outflow from MR
                const mrId = transaction.location_id_source;
                if (locationFilter === 'ALL' || 
                    locationFilter === 'MR' || 
                    (locationFilter.startsWith('MR_') && locationFilter.replace('MR_', '') === mrId)) {
                  const mrItem = getOrCreateStockItem(
                    transaction.product_id,
                    transaction.batch_id,
                    'MR',
                    mrId
                  );
                  mrItem.current_quantity_strips -= transaction.quantity_strips;
                }
              }
              
              // Skip default processing
              return;
            }
            
            // Apply the stock change if we determined a location and quantity change
            if (stockLocation && quantityChange !== 0) {
              // Apply location filter
              if (stockLocation === 'GODOWN' && locationFilter !== 'ALL' && locationFilter !== 'GODOWN') {
                return;
              }
              
              if (stockLocation === 'MR') {
                if (locationFilter !== 'ALL' && locationFilter !== 'MR' && 
                    !(locationFilter.startsWith('MR_') && locationFilter.replace('MR_', '') === stockLocationId)) {
                  return;
                }
              }
              
              const stockItem = getOrCreateStockItem(
                transaction.product_id,
                transaction.batch_id,
                stockLocation,
                stockLocationId || ''
              );
              
              stockItem.current_quantity_strips += quantityChange;
              
              // Update cost per strip for inflows
              if (quantityChange > 0) {
                stockItem.cost_per_strip = transaction.cost_per_strip_at_transaction;
              }
            }
          } catch (err) {
            console.error('Error processing transaction:', err, transaction);
          }
        });

        // Calculate total value and filter out zero/negative stock items
        const stockItems = Array.from(stockMap.values())
          .filter(item => item.current_quantity_strips > 0)
          .map(item => ({
            ...item,
            total_value: item.current_quantity_strips * item.cost_per_strip
          }));

        // Log some statistics for debugging
        console.log(`Final stock items count: ${stockItems.length}`);
        
        // Log stock by location type
        const godownItems = stockItems.filter(item => item.location_type === 'GODOWN');
        const mrItems = stockItems.filter(item => item.location_type === 'MR');
        console.log(`Godown items: ${godownItems.length}, MR items: ${mrItems.length}`);
        
        // Log top 5 items by quantity for verification
        const topItems = [...stockItems].sort((a, b) => b.current_quantity_strips - a.current_quantity_strips).slice(0, 5);
        console.log('Top 5 items by quantity:', topItems.map(item => ({
          product: item.product_name,
          batch: item.batch_number,
          location: item.location_type + (item.location_id ? `-${item.location_id}` : ''),
          qty: item.current_quantity_strips,
          value: item.total_value
        })));
        
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
