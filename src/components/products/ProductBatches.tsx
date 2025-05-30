
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Search, Filter } from 'lucide-react';
import BatchesTable from '@/components/batches/BatchesTable';
import BatchModal from '@/components/batches/BatchModal';

export interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  batch_cost_per_strip: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const ProductBatches = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch product details
  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) throw new Error('Product ID is required');
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, product_code, base_cost_per_strip')
        .eq('id', productId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch batches
  const { data: batches, isLoading: isLoadingBatches, refetch } = useQuery({
    queryKey: ['product-batches', productId, searchTerm, statusFilter],
    queryFn: async () => {
      if (!productId) return [];
      let query = supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      // Apply search filter
      if (searchTerm) {
        query = query.ilike('batch_number', `%${searchTerm}%`);
      }

      // Apply status filter
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductBatch[];
    },
  });

  const handleAddNew = () => {
    setEditingBatch(null);
    setIsModalOpen(true);
  };

  const handleEdit = (batch: ProductBatch) => {
    setEditingBatch(batch);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBatch(null);
  };

  const handleSuccess = () => {
    refetch();
    handleCloseModal();
  };

  if (isLoadingProduct) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p>Loading product...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Product not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Batches for {product.product_name}
          </h1>
          <p className="text-gray-600 mt-1">
            Product Code: {product.product_code} | Base Cost: ₹{product.base_cost_per_strip}/strip
          </p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by batch number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button onClick={handleAddNew} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add New Batch
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Recalled">Recalled</SelectItem>
                      <SelectItem value="Quarantined">Quarantined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {isLoadingBatches ? 'Loading...' : `${batches?.length || 0} batches found`}
        </p>
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Batches</CardTitle>
        </CardHeader>
        <CardContent>
          <BatchesTable
            batches={batches || []}
            isLoading={isLoadingBatches}
            onEdit={handleEdit}
            onRefresh={refetch}
            productId={productId!}
            baseCostPerStrip={product.base_cost_per_strip}
          />
        </CardContent>
      </Card>

      {/* Modal */}
      <BatchModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        editingBatch={editingBatch}
        productId={productId!}
        product={product}
      />
    </div>
  );
};

export default ProductBatches;
