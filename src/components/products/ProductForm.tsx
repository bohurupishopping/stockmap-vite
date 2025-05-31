import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, X } from 'lucide-react';
import BasicProductInfo from '@/components/products/BasicProductInfo';
import AdditionalProductInfo from '@/components/products/AdditionalProductInfo';
import CreateCategoryModal from '@/components/products/CreateCategoryModal';
import CreateSubCategoryModal from '@/components/products/CreateSubCategoryModal';
import CreateFormulationModal from '@/components/products/CreateFormulationModal';

// Define a type for packaging units for clarity
interface PackagingUnitData {
  unit_name: string;
  conversion_factor_to_strips: number;
  is_base_unit: boolean;
  order_in_hierarchy: number;
  template_id?: string;
  default_purchase_unit?: boolean;
  default_sales_unit_mr?: boolean;
  default_sales_unit_direct?: boolean;
}

interface ProductFormData {
  product_code: string;
  product_name: string;
  generic_name: string;
  manufacturer: string;
  category_id: string;
  sub_category_id: string | null; // Allow null for sub_category_id
  formulation_id: string;
  unit_of_measure_smallest: string;
  base_cost_per_strip: string;
  is_active: boolean;
  storage_conditions: string;
  image_url: string;
  min_stock_level_godown: string;
  min_stock_level_mr: string;
  lead_time_days: string;
  selected_packaging_template_name?: string; // For UI state from BasicProductInfo
  packaging_units?: PackagingUnitData[]; // For units derived from template
}

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient(); // Initialize queryClient
  const isEdit = !!id;

  const [formData, setFormData] = useState<ProductFormData>({
    product_code: '',
    product_name: '',
    generic_name: '',
    manufacturer: '',
    category_id: '',
    sub_category_id: null,
    formulation_id: '',
    unit_of_measure_smallest: 'Strip',
    base_cost_per_strip: '',
    is_active: true,
    storage_conditions: '',
    image_url: '',
    min_stock_level_godown: '',
    min_stock_level_mr: '',
    lead_time_days: '',
    selected_packaging_template_name: '',
    packaging_units: [],
  });

  const [activeTab, setActiveTab] = useState('basic');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [isFormulationModalOpen, setIsFormulationModalOpen] = useState(false);

  // Fetch the last used product code to generate the next one
  const { data: lastProductCode } = useQuery({
    queryKey: ['last-product-code'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('product_code')
        .ilike('product_code', 'MAP%')
        .order('product_code', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }
      return data;
    },
    enabled: !isEdit, // Only fetch for new products
  });

  // Generate new product code
  useEffect(() => {
    if (!isEdit && !formData.product_code && lastProductCode) {
      const lastCode = lastProductCode.product_code || 'MAP00000';
      const lastNumber = parseInt(lastCode.substring(3)); 
      const nextNumber = lastNumber + 1;
      const newCode = `MAP${nextNumber.toString().padStart(5, '0')}`;
      updateFormData({ product_code: newCode });
    }
  }, [lastProductCode, isEdit, formData.product_code]);

  // Fetch product data for editing
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  // Set form data when product is loaded for editing
  useEffect(() => {
    if (product && isEdit) {
      setFormData(prev => ({
        ...prev, // Keep existing packaging_units and selected_template_name if any from previous state
        product_code: product.product_code || '',
        product_name: product.product_name || '',
        generic_name: product.generic_name || '',
        manufacturer: product.manufacturer || '',
        category_id: product.category_id || '',
        sub_category_id: product.sub_category_id || null,
        formulation_id: product.formulation_id || '',
        unit_of_measure_smallest: product.unit_of_measure_smallest || 'Strip',
        base_cost_per_strip: product.base_cost_per_strip?.toString() || '',
        is_active: product.is_active ?? true,
        storage_conditions: product.storage_conditions || '',
        image_url: product.image_url || '',
        min_stock_level_godown: product.min_stock_level_godown?.toString() || '',
        min_stock_level_mr: product.min_stock_level_mr?.toString() || '',
        lead_time_days: product.lead_time_days?.toString() || '',
        // Note: packaging_units and selected_packaging_template_name are not directly loaded from 'product'
        // They would be managed by BasicProductInfo or a separate packaging management UI for existing products.
      }));
    }
  }, [product, isEdit]);

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async (currentFormData: ProductFormData) => {
      const { 
        packaging_units, 
        selected_packaging_template_name, 
        ...productFields 
      } = currentFormData;

      const productDataToSave = {
        ...productFields,
        base_cost_per_strip: parseFloat(productFields.base_cost_per_strip) || 0,
        min_stock_level_godown: parseInt(productFields.min_stock_level_godown) || 0,
        min_stock_level_mr: parseInt(productFields.min_stock_level_mr) || 0,
        lead_time_days: parseInt(productFields.lead_time_days) || 0,
        sub_category_id: productFields.sub_category_id || null,
      };

      if (isEdit && id) {
        const { data: updatedProduct, error } = await supabase
          .from('products')
          .update(productDataToSave)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return { product: updatedProduct, packagingError: null }; 
        // For edits, packaging units are typically managed on a separate screen.
        // If you need to update them here, fetch existing, compare, and update/insert/delete.
      } else {
        // Create new product
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert(productDataToSave)
          .select()
          .single();
        if (productError) throw productError;

        let packagingError = null;
        if (newProduct && packaging_units && packaging_units.length > 0) {
          const packagingUnitsToInsert = packaging_units.map(unit => ({
            product_id: newProduct.id,
            unit_name: unit.unit_name,
            conversion_factor_to_strips: unit.conversion_factor_to_strips,
            is_base_unit: unit.is_base_unit,
            order_in_hierarchy: unit.order_in_hierarchy,
            template_id: unit.template_id || null,
            default_purchase_unit: unit.default_purchase_unit || false,
            default_sales_unit_mr: unit.default_sales_unit_mr || false,
            default_sales_unit_direct: unit.default_sales_unit_direct || false,
          }));

          const { error } = await supabase
            .from('product_packaging_units')
            .insert(packagingUnitsToInsert);
          if (error) packagingError = error;
        }
        return { product: newProduct, packagingError };
      }
    },
    onSuccess: ({ product, packagingError }) => {
      if (packagingError) {
        toast({
          title: "Warning",
          description: `Product ${isEdit ? 'updated' : 'created'}, but failed to save packaging units: ${packagingError.message}`,
          variant: "destructive", // Or a 'warning' variant if you have one
        });
      } else {
        toast({
          title: "Success",
          description: `Product ${isEdit ? 'updated' : 'created'} successfully.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (!isEdit && product) {
         // Optionally navigate to product packaging page or product details after creation
        navigate(`/admin/products/${product.id}/packaging`); 
      } else {
        navigate('/admin/products');
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to ${isEdit ? 'update' : 'create'} product: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.product_code || !formData.product_name || !formData.generic_name || 
        !formData.manufacturer || !formData.category_id || !formData.formulation_id || !formData.base_cost_per_strip) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields in Basic Information.",
        variant: "destructive",
      });
      setActiveTab('basic'); // Switch to basic tab if validation fails
      return;
    }

    saveProductMutation.mutate(formData);
  };

  const updateFormData = (updates: Partial<ProductFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleCategoryCreated = (categoryId: string) => {
    updateFormData({ category_id: categoryId, sub_category_id: null });
    queryClient.invalidateQueries({ queryKey: ['product-categories']});
  };

  const handleSubCategoryCreated = (subCategoryId: string) => {
    updateFormData({ sub_category_id: subCategoryId });
    queryClient.invalidateQueries({ queryKey: ['product-sub-categories', formData.category_id]});
  };

  const handleFormulationCreated = (formulationId: string) => {
    updateFormData({ formulation_id: formulationId });
    queryClient.invalidateQueries({ queryKey: ['product-formulations']});
  };

  if (isEdit && isLoading) {
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEdit ? 'Update product information' : 'Create a new product in your catalog'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                <TabsTrigger value="additional">Additional Information</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic">
                <BasicProductInfo 
                  formData={formData} 
                  updateFormData={updateFormData}
                  onCreateCategory={() => setIsCategoryModalOpen(true)}
                  onCreateSubCategory={() => setIsSubCategoryModalOpen(true)}
                  onCreateFormulation={() => setIsFormulationModalOpen(true)}
                />
              </TabsContent>
              
              <TabsContent value="additional">
                <AdditionalProductInfo 
                  formData={formData} 
                  updateFormData={updateFormData} 
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/admin/products')}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveProductMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveProductMutation.isPending 
                  ? (isEdit ? 'Updating...' : 'Creating...') 
                  : (isEdit ? 'Update Product' : 'Create Product')
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Modals */} 
      <CreateCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={handleCategoryCreated}
      />

      <CreateSubCategoryModal
        isOpen={isSubCategoryModalOpen}
        onClose={() => setIsSubCategoryModalOpen(false)}
        onSuccess={handleSubCategoryCreated}
        categoryId={formData.category_id}
      />

      <CreateFormulationModal
        isOpen={isFormulationModalOpen}
        onClose={() => setIsFormulationModalOpen(false)}
        onSuccess={handleFormulationCreated}
      />
    </div>
  );
};

export default ProductForm;
