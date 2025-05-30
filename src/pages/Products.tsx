
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Filter, Edit, Trash2, Eye, Package, Package2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductFilters from '@/components/products/ProductFilters';
import ProductTableColumns from '@/components/products/ProductTableColumns';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const Products = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    subCategory: '',
    formulation: '',
    manufacturer: '',
    isActive: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    productCode: true,
    productName: true,
    genericName: true,
    manufacturer: true,
    category: true,
    subCategory: true,
    formulation: true,
    baseCost: true,
    status: true,
    godownMin: true,
    mrMin: true,
    actions: true,
  });

  const handleColumnToggle = (columns: Record<string, boolean>) => {
    setVisibleColumns(columns);
  };

  const getHeaderClass = (key: string) => 
    cn(
      'text-left text-xs font-medium text-muted-foreground uppercase tracking-wider',
      !visibleColumns[key] && 'hidden'
    );

  const getCellClass = (key: string) => 
    cn(
      'py-3 text-sm',
      !visibleColumns[key] && 'hidden'
    );

  // Fetch products with related data
  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ['products', searchTerm, filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:product_categories(category_name),
          sub_category:product_sub_categories(sub_category_name),
          formulation:product_formulations(formulation_name)
        `);

      // Apply search
      if (searchTerm) {
        query = query.or(`product_code.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,generic_name.ilike.%${searchTerm}%,manufacturer.ilike.%${searchTerm}%`);
      }

      // Apply filters
      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }
      if (filters.subCategory) {
        query = query.eq('sub_category_id', filters.subCategory);
      }
      if (filters.formulation) {
        query = query.eq('formulation_id', filters.formulation);
      }
      if (filters.manufacturer) {
        query = query.ilike('manufacturer', `%${filters.manufacturer}%`);
      }
      if (filters.isActive !== '') {
        query = query.eq('is_active', filters.isActive === 'true');
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete product.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Product deleted successfully.",
        });
        refetch();
      }
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error loading products: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil((products?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = products?.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Products Management</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog and inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <ProductTableColumns 
            onColumnToggle={handleColumnToggle} 
            columns={[
              { key: 'productCode', label: 'Product Code', defaultVisible: true },
              { key: 'productName', label: 'Product Name', defaultVisible: true },
              { key: 'genericName', label: 'Generic Name', defaultVisible: true },
              { key: 'manufacturer', label: 'Manufacturer', defaultVisible: true },
              { key: 'category', label: 'Category', defaultVisible: true },
              { key: 'subCategory', label: 'Sub-Category', defaultVisible: true },
              { key: 'formulation', label: 'Formulation', defaultVisible: true },
              { key: 'baseCost', label: 'Base Cost/Strip', defaultVisible: true },
              { key: 'status', label: 'Status', defaultVisible: true },
              { key: 'godownMin', label: 'Godown Min.', defaultVisible: true },
              { key: 'mrMin', label: 'MR Min.', defaultVisible: true },
              { key: 'actions', label: 'Actions', defaultVisible: true },
            ]}
          />
          <Link to="/admin/products/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Product</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by product code, name, generic name, or manufacturer..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="pl-10 h-10"
              />
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2 h-10"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <ProductFilters 
                filters={filters} 
                setFilters={(newFilters) => {
                  setFilters(newFilters);
                  setCurrentPage(1); // Reset to first page when filters change
                }} 
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            'Loading products...'
          ) : products?.length ? (
            `Showing ${startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, products.length)} of ${products.length} products`
          ) : (
            'No products found'
          )}
        </p>
      </div>

      {/* Products Table */}
      <Card className="overflow-hidden">
        <div className="rounded-md border">
          <div className="relative w-full overflow-auto">
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {visibleColumns.productCode && <TableHead className={getHeaderClass('productCode')}>Product Code</TableHead>}
                  {visibleColumns.productName && <TableHead className={getHeaderClass('productName')}>Product Name</TableHead>}
                  {visibleColumns.genericName && <TableHead className={getHeaderClass('genericName')}>Generic Name</TableHead>}
                  {visibleColumns.manufacturer && <TableHead className={getHeaderClass('manufacturer')}>Manufacturer</TableHead>}
                  {visibleColumns.category && <TableHead className={getHeaderClass('category')}>Category</TableHead>}
                  {visibleColumns.subCategory && <TableHead className={getHeaderClass('subCategory')}>Sub-Category</TableHead>}
                  {visibleColumns.formulation && <TableHead className={getHeaderClass('formulation')}>Formulation</TableHead>}
                  {visibleColumns.baseCost && <TableHead className={getHeaderClass('baseCost')}>Base Cost/Strip</TableHead>}
                  {visibleColumns.status && <TableHead className={getHeaderClass('status')}>Status</TableHead>}
                  {visibleColumns.godownMin && <TableHead className={getHeaderClass('godownMin')}>Godown Min.</TableHead>}
                  {visibleColumns.mrMin && <TableHead className={getHeaderClass('mrMin')}>MR Min.</TableHead>}
                  {visibleColumns.actions && <TableHead className={getHeaderClass('actions')}><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <p className="text-muted-foreground">Loading products...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !paginatedProducts?.length ? (
                  <TableRow>
                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Package className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No products found matching your criteria.</p>
                        <Button variant="outline" size="sm" onClick={() => {
                          setSearchTerm('');
                          setFilters({
                            category: '',
                            subCategory: '',
                            formulation: '',
                            manufacturer: '',
                            isActive: '',
                          });
                        }}>
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted/50">
                      {visibleColumns.productCode && (
                        <TableCell className={getCellClass('productCode')}>
                          <span className="font-mono text-sm">{product.product_code}</span>
                        </TableCell>
                      )}
                      {visibleColumns.productName && (
                        <TableCell className={getCellClass('productName')}>
                          <span className="font-medium">{product.product_name}</span>
                        </TableCell>
                      )}
                      {visibleColumns.genericName && (
                        <TableCell className={getCellClass('genericName')}>
                          <span className="text-muted-foreground">{product.generic_name || '-'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.manufacturer && (
                        <TableCell className={getCellClass('manufacturer')}>
                          {product.manufacturer}
                        </TableCell>
                      )}
                      {visibleColumns.category && (
                        <TableCell className={getCellClass('category')}>
                          {product.category?.category_name || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.subCategory && (
                        <TableCell className={getCellClass('subCategory')}>
                          {product.sub_category?.sub_category_name || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.formulation && (
                        <TableCell className={getCellClass('formulation')}>
                          {product.formulation?.formulation_name || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.baseCost && (
                        <TableCell className={getCellClass('baseCost')}>
                          <span className="font-mono">₹{product.base_cost_per_strip || '0.00'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.status && (
                        <TableCell className={getCellClass('status')}>
                          <Badge variant={product.is_active ? "default" : "secondary"}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.godownMin && (
                        <TableCell className={getCellClass('godownMin')}>
                          {product.min_stock_level_godown || 0}
                        </TableCell>
                      )}
                      {visibleColumns.mrMin && (
                        <TableCell className={getCellClass('mrMin')}>
                          {product.min_stock_level_mr || 0}
                        </TableCell>
                      )}
                      {visibleColumns.actions && (
                        <TableCell className={getCellClass('actions')}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link to={`/admin/products/${product.id}`} title="View details">
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link to={`/admin/products/${product.id}/edit`} title="Edit">
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link to={`/admin/products/${product.id}/packaging`} title="Packaging">
                                <Package2 className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link to={`/admin/products/${product.id}/batches`} title="Batches">
                                <Package className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteProduct(product.id);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        {totalPages > 1 && (
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
    </div>
  );
};

export default Products;
