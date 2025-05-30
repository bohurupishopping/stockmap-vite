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
import { Plus, Search, Filter, Edit, Trash2, Eye, Package, Package2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw } from 'lucide-react';
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
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Products Management</h1>
          <p className="text-gray-600">Manage your product catalog and inventory</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 h-8 w-40 rounded-full border-0 focus-visible:ring-1"
              />
            </div>
            
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 px-3 rounded-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
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
                { key: 'baseCost', label: 'Base Cost', defaultVisible: true },
                { key: 'status', label: 'Status', defaultVisible: true },
                { key: 'godownMin', label: 'Godown Min.', defaultVisible: true },
                { key: 'mrMin', label: 'MR Min.', defaultVisible: true },
                { key: 'actions', label: 'Actions', defaultVisible: true },
              ]}
            />

            <Link to="/admin/products/new">
              <Button 
                className="h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Product
              </Button>
            </Link>
            <Link to="/admin/product-categories">
              <Button 
                className="h-8 px-3 bg-green-600 hover:bg-blue-700 rounded-full text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Category
              </Button>
            </Link>
            <Link to="/admin/product-formulations">
              <Button 
                className="h-8 px-3 bg-red-600 hover:bg-blue-700 rounded-full text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Formulation
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${products?.length || 0} products found`}
        </p>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6">
          <ProductFilters 
            filters={filters} 
            setFilters={(newFilters) => {
              setFilters(newFilters);
              setCurrentPage(1);
            }} 
          />
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Product List</h2>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="p-4">
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
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
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Loading products...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !paginatedProducts?.length ? (
                  <TableRow>
                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Package className="h-8 w-8 text-gray-400" />
                        <p className="text-gray-500">No products found</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setSearchTerm('');
                            setFilters({
                              category: '',
                              subCategory: '',
                              formulation: '',
                              manufacturer: '',
                              isActive: '',
                            });
                          }}
                          className="h-8 px-3 rounded-full"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-gray-50">
                      {visibleColumns.productCode && (
                        <TableCell className={getCellClass('productCode')}>
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {product.product_code}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.productName && (
                        <TableCell className={getCellClass('productName')}>
                          <div className="font-medium">{product.product_name}</div>
                        </TableCell>
                      )}
                      {visibleColumns.genericName && (
                        <TableCell className={getCellClass('genericName')}>
                          <span className="text-gray-600">{product.generic_name || '-'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.manufacturer && (
                        <TableCell className={getCellClass('manufacturer')}>
                          <span className="text-gray-600">{product.manufacturer || '-'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.category && (
                        <TableCell className={getCellClass('category')}>
                          <span className="text-gray-600">{product.category?.category_name || '-'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.subCategory && (
                        <TableCell className={getCellClass('subCategory')}>
                          <span className="text-gray-600">{product.sub_category?.sub_category_name || '-'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.formulation && (
                        <TableCell className={getCellClass('formulation')}>
                          <span className="text-gray-600">{product.formulation?.formulation_name || '-'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.baseCost && (
                        <TableCell className={getCellClass('baseCost')}>
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            ₹{product.base_cost_per_strip}
                          </span>
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
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {product.min_stock_level_godown || 0}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.mrMin && (
                        <TableCell className={getCellClass('mrMin')}>
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {product.min_stock_level_mr || 0}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.actions && (
                        <TableCell className={getCellClass('actions')}>
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                              asChild
                            >
                              <Link to={`/admin/products/${product.id}`} title="View details">
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                              asChild
                            >
                              <Link to={`/admin/products/${product.id}/edit`} title="Edit">
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                              asChild
                            >
                              <Link to={`/admin/products/${product.id}/packaging`} title="Packaging">
                                <Package2 className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                              asChild
                            >
                              <Link to={`/admin/products/${product.id}/batches`} title="Batches">
                                <Package className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-red-50 text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteProduct(product.id)}
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
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
        </div>
      )}
    </div>
  );
};

export default Products;
