import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductTableColumns from '@/components/products/ProductTableColumns';

export interface StockItem {
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

export interface StockColumnConfig extends Record<string, boolean> {
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

export const STOCK_TABLE_COLUMNS = [
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

export const defaultStockColumns: StockColumnConfig = {
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

export type SortField = 'product_name' | 'generic_name' | 'batch_number' | 'expiry_date' | 
                'current_quantity_strips' | 'cost_per_strip' | 'total_value';
export type SortDirection = 'asc' | 'desc';

interface StockTableProps {
  stockData: StockItem[] | undefined;
  isLoading: boolean;
  visibleColumns: Record<string, boolean>;
  onColumnToggle: (columns: Record<string, boolean>) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
}

const StockTable: React.FC<StockTableProps> = ({
  stockData,
  isLoading,
  visibleColumns,
  onColumnToggle,
  sortField,
  sortDirection,
  onSort,
  currentPage,
  setCurrentPage,
  itemsPerPage
}) => {
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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <CardTitle>Stock Details</CardTitle>
          <CardDescription>Current stock levels across all locations</CardDescription>
        </div>
        <ProductTableColumns 
          onColumnToggle={onColumnToggle} 
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
                      onClick={() => onSort('product_name')}
                    >
                      Product {sortField === 'product_name' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.genericName && (
                    <TableHead 
                      className={getHeaderClass('genericName')}
                      onClick={() => onSort('generic_name')}
                    >
                      Generic Name {sortField === 'generic_name' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.batchNumber && (
                    <TableHead 
                      className={getHeaderClass('batchNumber')}
                      onClick={() => onSort('batch_number')}
                    >
                      Batch Number {sortField === 'batch_number' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.expiryDate && (
                    <TableHead 
                      className={getHeaderClass('expiryDate')}
                      onClick={() => onSort('expiry_date')}
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
                      onClick={() => onSort('current_quantity_strips')}
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
                      onClick={() => onSort('cost_per_strip')}
                    >
                      Cost per Strip {sortField === 'cost_per_strip' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.totalValue && (
                    <TableHead 
                      className={getHeaderClass('totalValue')}
                      onClick={() => onSort('total_value')}
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
                          // This will be handled by the parent component
                        }}>
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  getSortedData(stockData)
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
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
            Page {currentPage} of {Math.ceil(stockData.length / itemsPerPage)}
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
              onClick={() => setCurrentPage(Math.min(Math.ceil(stockData.length / itemsPerPage), currentPage + 1))}
              disabled={currentPage === Math.ceil(stockData.length / itemsPerPage)}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.ceil(stockData.length / itemsPerPage))}
              disabled={currentPage === Math.ceil(stockData.length / itemsPerPage)}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default StockTable; 