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
import { Package, TrendingDown, AlertTriangle, DollarSign, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ProductTableColumns from '@/components/products/ProductTableColumns';

const ITEMS_PER_PAGE = 20;

interface StockColumnConfig extends Record<string, boolean> {
  product: boolean;
  genericName: boolean;
  batchNumber: boolean;
  expiryDate: boolean;
  location: boolean;
  currentQuantityStrips: boolean;
  currentQuantityDisplay: boolean;
  costPerStrip: boolean;
  totalValue: boolean;
  stockStatus: boolean;
  expiryStatus: boolean;
}

const defaultStockColumns: StockColumnConfig = {
  product: true,
  genericName: true,
  batchNumber: true,
  expiryDate: true,
  location: true,
  currentQuantityStrips: true,
  currentQuantityDisplay: true,
  costPerStrip: true,
  totalValue: true,
  stockStatus: true,
  expiryStatus: true,
};

const STOCK_TABLE_COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'genericName', label: 'Generic Name' },
  { key: 'batchNumber', label: 'Batch Number' },
  { key: 'expiryDate', label: 'Expiry Date' },
  { key: 'location', label: 'Location' },
  { key: 'currentQuantityStrips', label: 'Current Qty (Strips)' },
  { key: 'currentQuantityDisplay', label: 'Current Qty (Display)' },
  { key: 'costPerStrip', label: 'Cost per Strip' },
  { key: 'totalValue', label: 'Total Value' },
  { key: 'stockStatus', label: 'Stock Status' },
  { key: 'expiryStatus', label: 'Expiry Status' },
];

interface StockItem {
  product_id: string;
  product_name: string;
  product_code: string;
  generic_name: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  location_type: string;
  location_id: string;
  current_quantity_strips: number;
  cost_per_strip: number;
  total_value: number;
  category_name?: string;
  min_stock_level_godown?: number;
  min_stock_level_mr?: number;
}

interface StockSummary {
  total_products: number;
  total_batches: number;
  total_value: number;
  low_stock_items: number;
  expiring_soon_items: number;
}

type SortField = 'product_name' | 'generic_name' | 'batch_number' | 'expiry_date' | 
                'current_quantity_strips' | 'cost_per_strip' | 'total_value';
type SortDirection = 'asc' | 'desc';

const StockStatus = () => {
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

  const getSortedData = (data: StockItem[]) => {
    if (!data) return [];
    
    return [...data].sort((a, b) => {
      let compareA, compareB;
      
      switch (sortField) {
        case 'product_name':
          compareA = a.product_name.toLowerCase();
          compareB = b.product_name.toLowerCase();
          break;
        case 'generic_name':
          compareA = (a.generic_name || '').toLowerCase();
          compareB = (b.generic_name || '').toLowerCase();
          break;
        case 'batch_number':
          compareA = a.batch_number.toLowerCase();
          compareB = b.batch_number.toLowerCase();
          break;
        case 'expiry_date':
          compareA = new Date(a.expiry_date).getTime();
          compareB = new Date(b.expiry_date).getTime();
          break;
        case 'current_quantity_strips':
          compareA = a.current_quantity_strips;
          compareB = b.current_quantity_strips;
          break;
        case 'cost_per_strip':
          compareA = a.cost_per_strip;
          compareB = b.cost_per_strip;
          break;
        case 'total_value':
          compareA = a.total_value;
          compareB = b.total_value;
          break;
        default:
          compareA = a.product_name.toLowerCase();
          compareB = b.product_name.toLowerCase();
      }
      
      const comparison = compareA > compareB ? 1 : compareA < compareB ? -1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const getHeaderClass = (key: string) => 
    cn(
      'text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer',
      !visibleColumns[key] && 'hidden'
    );

  const getCellClass = (key: string) => 
    cn(
      'py-3 text-sm',
      !visibleColumns[key] && 'hidden'
    );

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

  const getExpiryStatus = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    if (expiry < today) {
      return { status: 'expired', variant: 'destructive' as const };
    } else if (expiry <= thirtyDaysFromNow) {
      return { status: 'expiring-soon', variant: 'secondary' as const };
    } else {
      return { status: 'good', variant: 'default' as const };
    }
  };

  const getStockStatus = (item: StockItem) => {
    const minLevel = item.location_type === 'GODOWN' 
      ? item.min_stock_level_godown || 0
      : item.min_stock_level_mr || 0;

    if (item.current_quantity_strips <= minLevel) {
      return { status: 'low', variant: 'destructive' as const };
    } else if (item.current_quantity_strips <= minLevel * 1.5) {
      return { status: 'medium', variant: 'secondary' as const };
    } else {
      return { status: 'good', variant: 'default' as const };
    }
  };

  const convertStripsToDisplayUnit = (strips: number) => {
    // For now, just show strips. Later this can be enhanced with packaging unit conversion
    return `${strips} strips`;
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Real-time Stock Status</h1>
        </div>

        {/* Summary Cards */}
        <Dialog>
          <DialogTrigger asChild>
            <button className="rounded-md bg-blue-600 px-4 py-2 text-white font-semibold shadow-md hover:bg-blue-700 transition">
              Show Summary
            </button>
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

        {/* Filters */}
        <Card className="rounded-lg shadow-md border border-gray-300">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Filters</CardTitle>
            <CardDescription className="text-gray-600">
              Filter stock data by various criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <div>
                <Label htmlFor="location" className="block mb-1 font-medium text-gray-700">
                  Location
                </Label>
                <Select
                  value={locationFilter}
                  onValueChange={setLocationFilter}
                >
                  <SelectTrigger className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <SelectItem value="ALL">All Locations</SelectItem>
                    <SelectItem value="GODOWN">Main Godown</SelectItem>
                    <SelectItem value="MR">All MRs</SelectItem>
                    {mrUsers?.map((user) => (
                      <SelectItem key={user.user_id} value={`MR_${user.user_id}`}>
                        MR: {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="product" className="block mb-1 font-medium text-gray-700">
                  Product
                </Label>
                <Input
                  id="product"
                  placeholder="Search products..."
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label htmlFor="category" className="block mb-1 font-medium text-gray-700">
                  Category
                </Label>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <SelectItem value="ALL">All Categories</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.category_name} value={category.category_name}>
                        {category.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="batch" className="block mb-1 font-medium text-gray-700">
                  Batch
                </Label>
                <Input
                  id="batch"
                  placeholder="Search batches..."
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label htmlFor="expiryFrom" className="block mb-1 font-medium text-gray-700">
                  Expiry From
                </Label>
                <Input
                  id="expiryFrom"
                  type="date"
                  value={expiryFromDate}
                  onChange={(e) => setExpiryFromDate(e.target.value)}
                  className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label htmlFor="expiryTo" className="block mb-1 font-medium text-gray-700">
                  Expiry To
                </Label>
                <Input
                  id="expiryTo"
                  type="date"
                  value={expiryToDate}
                  onChange={(e) => setExpiryToDate(e.target.value)}
                  className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock Table */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <CardTitle>Stock Details</CardTitle>
              <CardDescription>Current stock levels across all locations</CardDescription>
            </div>
            <ProductTableColumns 
              onColumnToggle={handleColumnToggle} 
              storageKey="stock-table-columns"
              columns={STOCK_TABLE_COLUMNS}
            />
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="relative w-full overflow-auto">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      {visibleColumns.product && (
                        <TableHead 
                          className={getHeaderClass('product')}
                          onClick={() => handleSort('product_name')}
                        >
                          Product {sortField === 'product_name' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                      )}
                      {visibleColumns.genericName && (
                        <TableHead 
                          className={getHeaderClass('genericName')}
                          onClick={() => handleSort('generic_name')}
                        >
                          Generic Name {sortField === 'generic_name' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                      )}
                      {visibleColumns.batchNumber && (
                        <TableHead 
                          className={getHeaderClass('batchNumber')}
                          onClick={() => handleSort('batch_number')}
                        >
                          Batch Number {sortField === 'batch_number' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                      )}
                      {visibleColumns.expiryDate && (
                        <TableHead 
                          className={getHeaderClass('expiryDate')}
                          onClick={() => handleSort('expiry_date')}
                        >
                          Expiry Date {sortField === 'expiry_date' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                      )}
                      {visibleColumns.location && (
                        <TableHead className={getHeaderClass('location')}>Location</TableHead>
                      )}
                      {visibleColumns.currentQuantityStrips && (
                        <TableHead 
                          className={getHeaderClass('currentQuantityStrips')}
                          onClick={() => handleSort('current_quantity_strips')}
                        >
                          Current Qty (Strips) {sortField === 'current_quantity_strips' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                      )}
                      {visibleColumns.currentQuantityDisplay && (
                        <TableHead className={getHeaderClass('currentQuantityDisplay')}>Current Qty (Display)</TableHead>
                      )}
                      {visibleColumns.costPerStrip && (
                        <TableHead 
                          className={getHeaderClass('costPerStrip')}
                          onClick={() => handleSort('cost_per_strip')}
                        >
                          Cost per Strip {sortField === 'cost_per_strip' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                      )}
                      {visibleColumns.totalValue && (
                        <TableHead 
                          className={getHeaderClass('totalValue')}
                          onClick={() => handleSort('total_value')}
                        >
                          Total Value {sortField === 'total_value' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                      )}
                      {visibleColumns.stockStatus && (
                        <TableHead className={getHeaderClass('stockStatus')}>Stock Status</TableHead>
                      )}
                      {visibleColumns.expiryStatus && (
                        <TableHead className={getHeaderClass('expiryStatus')}>Expiry Status</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="text-muted-foreground">Loading stock data...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : !stockData?.length ? (
                      <TableRow>
                        <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Package className="h-8 w-8 text-muted-foreground" />
                            <p className="text-muted-foreground">No stock data found for the selected filters</p>
                            <Button variant="outline" size="sm" onClick={() => {
                              setProductFilter('');
                              setCategoryFilter('ALL');
                              setBatchFilter('');
                              setExpiryFromDate('');
                              setExpiryToDate('');
                            }}>
                              Clear filters
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      getSortedData(stockData)
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((item, index) => {
                          const stockStatus = getStockStatus(item);
                          const expiryStatus = getExpiryStatus(item.expiry_date);
                          
                          return (
                            <TableRow key={index} className="hover:bg-muted/50">
                              {visibleColumns.product && (
                                <TableCell className={getCellClass('product')}>
                                  <div className="space-y-1">
                                    <div className="font-medium">{item.product_code}</div>
                                    <div className="text-muted-foreground text-sm">{item.product_name}</div>
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.genericName && (
                                <TableCell className={getCellClass('genericName')}>
                                  <span className="text-muted-foreground">{item.generic_name || '-'}</span>
                                </TableCell>
                              )}
                              {visibleColumns.batchNumber && (
                                <TableCell className={getCellClass('batchNumber')}>
                                  {item.batch_number}
                                </TableCell>
                              )}
                              {visibleColumns.expiryDate && (
                                <TableCell className={getCellClass('expiryDate')}>
                                  {new Date(item.expiry_date).toLocaleDateString()}
                                </TableCell>
                              )}
                              {visibleColumns.location && (
                                <TableCell className={getCellClass('location')}>
                                  <Badge variant="outline">
                                    {item.location_type === 'GODOWN' ? 'Godown' : `MR ${item.location_id || '-'}`}
                                  </Badge>
                                </TableCell>
                              )}
                              {visibleColumns.currentQuantityStrips && (
                                <TableCell className={getCellClass('currentQuantityStrips')}>
                                  {item.current_quantity_strips}
                                </TableCell>
                              )}
                              {visibleColumns.currentQuantityDisplay && (
                                <TableCell className={getCellClass('currentQuantityDisplay')}>
                                  {convertStripsToDisplayUnit(item.current_quantity_strips)}
                                </TableCell>
                              )}
                              {visibleColumns.costPerStrip && (
                                <TableCell className={getCellClass('costPerStrip')}>
                                  ₹{item.cost_per_strip.toFixed(2)}
                                </TableCell>
                              )}
                              {visibleColumns.totalValue && (
                                <TableCell className={getCellClass('totalValue')}>
                                  ₹{item.total_value.toFixed(2)}
                                </TableCell>
                              )}
                              {visibleColumns.stockStatus && (
                                <TableCell className={getCellClass('stockStatus')}>
                                  <Badge variant={stockStatus.variant}>
                                    {stockStatus.status === 'low' ? 'Low Stock' : 
                                     stockStatus.status === 'medium' ? 'Medium' : 'Good'}
                                  </Badge>
                                </TableCell>
                              )}
                              {visibleColumns.expiryStatus && (
                                <TableCell className={getCellClass('expiryStatus')}>
                                  <Badge variant={expiryStatus.variant}>
                                    {expiryStatus.status === 'expired' ? 'Expired' :
                                     expiryStatus.status === 'expiring-soon' ? 'Expiring Soon' : 'Good'}
                                  </Badge>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
          {stockData?.length > 0 && (
            <CardFooter className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {Math.ceil(stockData.length / ITEMS_PER_PAGE)}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center text-sm font-medium w-8">
                  {currentPage}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(Math.ceil(stockData.length / ITEMS_PER_PAGE), currentPage + 1))}
                  disabled={currentPage === Math.ceil(stockData.length / ITEMS_PER_PAGE)}
                  className="h-8 w-8 p-0"
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.ceil(stockData.length / ITEMS_PER_PAGE))}
                  disabled={currentPage === Math.ceil(stockData.length / ITEMS_PER_PAGE)}
                  className="h-8 w-8 p-0"
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>

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

export default StockStatus;
