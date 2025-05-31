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
  stockData: StockItem[];
  isLoading: boolean;
  visibleColumns: Record<string, boolean>;
  onColumnToggle: (columns: Record<string, boolean>) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  totalPages: number;
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
  itemsPerPage,
  totalPages
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

  return (
    <Card className="rounded-lg border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">Stock Details</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Current stock levels across all locations
          </CardDescription>
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
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {visibleColumns.product && (
                    <TableHead 
                      className={cn(
                        'w-[250px] text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer',
                        !visibleColumns.product && 'hidden'
                      )}
                      onClick={() => onSort('product_name')}
                    >
                      Product {sortField === 'product_name' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.genericName && (
                    <TableHead 
                      className={cn(
                        'w-[200px] text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer',
                        !visibleColumns.genericName && 'hidden'
                      )}
                      onClick={() => onSort('generic_name')}
                    >
                      Generic Name {sortField === 'generic_name' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.batchNumber && (
                    <TableHead 
                      className={cn(
                        'w-[120px] text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer',
                        !visibleColumns.batchNumber && 'hidden'
                      )}
                      onClick={() => onSort('batch_number')}
                    >
                      Batch Number {sortField === 'batch_number' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.expiryDate && (
                    <TableHead 
                      className={cn(
                        'w-[120px] text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer',
                        !visibleColumns.expiryDate && 'hidden'
                      )}
                      onClick={() => onSort('expiry_date')}
                    >
                      Expiry Date {sortField === 'expiry_date' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.location && (
                    <TableHead className={cn(
                      'w-[120px] text-left text-xs font-medium text-muted-foreground uppercase tracking-wider',
                      !visibleColumns.location && 'hidden'
                    )}>
                      Location
                    </TableHead>
                  )}
                  {visibleColumns.currentQuantityStrips && (
                    <TableHead 
                      className={cn(
                        'w-[120px] text-center text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer',
                        !visibleColumns.currentQuantityStrips && 'hidden'
                      )}
                      onClick={() => onSort('current_quantity_strips')}
                    >
                      Current Qty {sortField === 'current_quantity_strips' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.costPerStrip && (
                    <TableHead 
                      className={cn(
                        'w-[120px] text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer',
                        !visibleColumns.costPerStrip && 'hidden'
                      )}
                      onClick={() => onSort('cost_per_strip')}
                    >
                      Cost/Strip {sortField === 'cost_per_strip' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.totalValue && (
                    <TableHead 
                      className={cn(
                        'w-[120px] text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer',
                        !visibleColumns.totalValue && 'hidden'
                      )}
                      onClick={() => onSort('total_value')}
                    >
                      Total Value {sortField === 'total_value' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  )}
                  {visibleColumns.stockStatus && (
                    <TableHead className={cn(
                      'w-[120px] text-center text-xs font-medium text-muted-foreground uppercase tracking-wider',
                      !visibleColumns.stockStatus && 'hidden'
                    )}>
                      Stock Status
                    </TableHead>
                  )}
                  {visibleColumns.expiryStatus && (
                    <TableHead className={cn(
                      'w-[120px] text-center text-xs font-medium text-muted-foreground uppercase tracking-wider',
                      !visibleColumns.expiryStatus && 'hidden'
                    )}>
                      Expiry Status
                    </TableHead>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  stockData.map((item, index) => {
                    const stockStatus = getStockStatus(item);
                    const expiryStatus = getExpiryStatus(item.expiry_date);
                    
                    return (
                      <TableRow key={index} className="hover:bg-muted/50">
                        {visibleColumns.product && (
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{item.product_code}</div>
                              <div className="text-muted-foreground text-sm">{item.product_name}</div>
                            </div>
                          </TableCell>
                        )}
                        {visibleColumns.genericName && (
                          <TableCell>
                            <span className="text-muted-foreground">{item.generic_name || '-'}</span>
                          </TableCell>
                        )}
                        {visibleColumns.batchNumber && (
                          <TableCell>
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {item.batch_number}
                            </span>
                          </TableCell>
                        )}
                        {visibleColumns.expiryDate && (
                          <TableCell>
                            {new Date(item.expiry_date).toLocaleDateString()}
                          </TableCell>
                        )}
                        {visibleColumns.location && (
                          <TableCell>
                            <Badge variant="outline">
                              {item.location_type === 'GODOWN' ? 'Godown' : `MR ${item.location_id || '-'}`}
                            </Badge>
                          </TableCell>
                        )}
                        {visibleColumns.currentQuantityStrips && (
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                              item.current_quantity_strips <= 0 
                                ? 'bg-red-100 text-red-800' 
                                : item.current_quantity_strips <= 10
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {item.current_quantity_strips}
                            </span>
                          </TableCell>
                        )}
                        {visibleColumns.costPerStrip && (
                          <TableCell className="text-right">
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              ₹{item.cost_per_strip.toFixed(2)}
                            </span>
                          </TableCell>
                        )}
                        {visibleColumns.totalValue && (
                          <TableCell className="text-right">
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              ₹{item.total_value.toFixed(2)}
                            </span>
                          </TableCell>
                        )}
                        {visibleColumns.stockStatus && (
                          <TableCell className="text-center">
                            <Badge variant={stockStatus.variant}>
                              {stockStatus.status === 'low' ? 'Low Stock' : 
                               stockStatus.status === 'medium' ? 'Medium' : 'Good'}
                            </Badge>
                          </TableCell>
                        )}
                        {visibleColumns.expiryStatus && (
                          <TableCell className="text-center">
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
      {totalPages > 0 && (
        <CardFooter className="flex items-center justify-between px-6 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
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
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
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