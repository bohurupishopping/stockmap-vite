import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus } from 'lucide-react';
import PackagingUnitsTable from '@/components/packaging/PackagingUnitsTable';
import PackagingUnitModal from '@/components/packaging/PackagingUnitModal';

export interface ProductPackagingUnit {
  id: string;
  product_id: string;
  unit_name: string;
  conversion_factor_to_strips: number;
  is_base_unit: boolean;
  order_in_hierarchy: number;
  default_purchase_unit: boolean;
  default_sales_unit_mr: boolean;
  default_sales_unit_direct: boolean;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

const ProductPackaging = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ProductPackagingUnit | null>(null);

  // Fetch product details
  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) throw new Error('Product ID is required');
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, product_code')
        .eq('id', productId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch packaging units
  const { data: packagingUnits, isLoading: isLoadingUnits, refetch } = useQuery({
    queryKey: ['packaging-units', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('product_packaging_units')
        .select('*')
        .eq('product_id', productId)
        .order('order_in_hierarchy', { ascending: true });
      if (error) throw error;
      return data as ProductPackagingUnit[];
    },
  });

  const handleAddNew = () => {
    setEditingUnit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (unit: ProductPackagingUnit) => {
    setEditingUnit(unit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
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
            Packaging Units for {product.product_name}
          </h1>
          <p className="text-gray-600 mt-1">
            Product Code: {product.product_code}
          </p>
        </div>
      </div>

      {/* Add New Button */}
      <div className="flex justify-end">
        <Button onClick={handleAddNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add New Packaging Unit
        </Button>
      </div>

      {/* Packaging Units Table */}
      <Card>
        <CardHeader>
          <CardTitle>Packaging Units</CardTitle>
        </CardHeader>
        <CardContent>
          <PackagingUnitsTable
            packagingUnits={packagingUnits || []}
            isLoading={isLoadingUnits}
            onEdit={handleEdit}
            onRefresh={refetch}
            productId={productId!}
          />
        </CardContent>
      </Card>

      {/* Modal */}
      <PackagingUnitModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        editingUnit={editingUnit}
        productId={productId!}
        product={product}
      />
    </div>
  );
};

export default ProductPackaging;
