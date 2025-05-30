
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';

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

const StockStatus = () => {
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [batchFilter, setBatchFilter] = useState('');
  const [expiryFromDate, setExpiryFromDate] = useState('');
  const [expiryToDate, setExpiryToDate] = useState('');

  // Fetch stock data with proper calculation
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock-status', locationFilter, productFilter, categoryFilter, batchFilter, expiryFromDate, expiryToDate],
    queryFn: async () => {
      let query = supabase
        .from('stock_transactions')
        .select(`
          product_id,
          batch_id,
          location_type_destination,
          location_id_destination,
          location_type_source,
          location_id_source,
          quantity_strips,
          cost_per_strip_at_transaction,
          transaction_type,
          products!inner (
            product_name,
            product_code,
            generic_name,
            min_stock_level_godown,
            min_stock_level_mr,
            product_categories!inner (
              category_name
            )
          ),
          product_batches!inner (
            batch_number,
            expiry_date
          )
        `);

      // Apply filters
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

      const { data, error } = await query;
      if (error) throw error;

      // Calculate actual stock by processing all transactions
      const stockMap = new Map<string, StockItem>();

      data?.forEach((transaction: any) => {
        const processLocation = (locationType: string, locationId: string, isIncoming: boolean) => {
          // Apply location filter
          if (locationFilter === 'GODOWN' && locationType !== 'GODOWN') return;
          if (locationFilter === 'MR' && locationType !== 'MR') return;
          if (locationFilter.startsWith('MR_') && (locationType !== 'MR' || locationId !== locationFilter.replace('MR_', ''))) return;

          const key = `${transaction.product_id}_${transaction.batch_id}_${locationType}_${locationId}`;
          
          // Calculate quantity change based on transaction type and direction
          let quantityChange = 0;
          
          if (isIncoming) {
            // Incoming stock (positive)
            if (transaction.transaction_type.includes('STOCK_IN') || 
                transaction.transaction_type.includes('RETURN') ||
                transaction.transaction_type.includes('REPLACEMENT_IN')) {
              quantityChange = transaction.quantity_strips;
            }
          } else {
            // Outgoing stock (negative)
            if (transaction.transaction_type.includes('DISPATCH') || 
                transaction.transaction_type.includes('SALE') ||
                transaction.transaction_type.includes('DAMAGE') ||
                transaction.transaction_type.includes('LOSS') ||
                transaction.transaction_type.includes('REPLACEMENT_OUT')) {
              quantityChange = -Math.abs(transaction.quantity_strips);
            }
          }

          if (quantityChange !== 0) {
            if (stockMap.has(key)) {
              const existing = stockMap.get(key)!;
              existing.current_quantity_strips += quantityChange;
              // Update cost per strip to the latest transaction cost
              if (quantityChange > 0) {
                existing.cost_per_strip = transaction.cost_per_strip_at_transaction;
              }
            } else {
              stockMap.set(key, {
                product_id: transaction.product_id,
                product_name: transaction.products.product_name,
                product_code: transaction.products.product_code,
                generic_name: transaction.products.generic_name,
                batch_id: transaction.batch_id,
                batch_number: transaction.product_batches.batch_number,
                expiry_date: transaction.product_batches.expiry_date,
                location_type: locationType,
                location_id: locationId,
                current_quantity_strips: quantityChange,
                cost_per_strip: transaction.cost_per_strip_at_transaction,
                total_value: 0,
                category_name: transaction.products.product_categories?.category_name,
                min_stock_level_godown: transaction.products.min_stock_level_godown,
                min_stock_level_mr: transaction.products.min_stock_level_mr,
              });
            }
          }
        };

        // Process destination (incoming stock)
        if (transaction.location_type_destination && transaction.location_id_destination) {
          processLocation(transaction.location_type_destination, transaction.location_id_destination, true);
        }

        // Process source (outgoing stock)
        if (transaction.location_type_source && transaction.location_id_source) {
          processLocation(transaction.location_type_source, transaction.location_id_source, false);
        }
      });

      // Calculate total value and filter out zero/negative stock items
      const stockItems = Array.from(stockMap.values())
        .filter(item => item.current_quantity_strips > 0)
        .map(item => ({
          ...item,
          total_value: item.current_quantity_strips * item.cost_per_strip
        }));

      return stockItems;
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
        <Card>
          <CardHeader>
            <CardTitle>Stock Details</CardTitle>
            <CardDescription>Current stock levels across all locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Generic Name</TableHead>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Current Qty (Strips)</TableHead>
                    <TableHead>Current Qty (Display)</TableHead>
                    <TableHead>Cost per Strip</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Stock Status</TableHead>
                    <TableHead>Expiry Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockData?.map((item, index) => {
                    const stockStatus = getStockStatus(item);
                    const expiryStatus = getExpiryStatus(item.expiry_date);
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.product_code}</div>
                            <div className="text-sm text-gray-500">{item.product_name}</div>
                          </div>
                        </TableCell>
                        <TableCell>{item.generic_name}</TableCell>
                        <TableCell>{item.batch_number}</TableCell>
                        <TableCell>{new Date(item.expiry_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.location_type === 'GODOWN' ? 'Godown' : `MR`}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.current_quantity_strips}</TableCell>
                        <TableCell>{convertStripsToDisplayUnit(item.current_quantity_strips)}</TableCell>
                        <TableCell>₹{item.cost_per_strip.toFixed(2)}</TableCell>
                        <TableCell>₹{item.total_value.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={stockStatus.variant}>
                            {stockStatus.status === 'low' ? 'Low Stock' : 
                             stockStatus.status === 'medium' ? 'Medium' : 'Good'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={expiryStatus.variant}>
                            {expiryStatus.status === 'expired' ? 'Expired' :
                             expiryStatus.status === 'expiring-soon' ? 'Expiring Soon' : 'Good'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {(!stockData || stockData.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  No stock data found for the selected filters
                </div>
              )}
            </div>
          </CardContent>
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
