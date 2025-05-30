import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, X, Plus } from 'lucide-react';
import BasicProductInfo from '@/components/products/BasicProductInfo';
import AdditionalProductInfo from '@/components/products/AdditionalProductInfo';
import CreateCategoryModal from '@/components/products/CreateCategoryModal';
import CreateSubCategoryModal from '@/components/products/CreateSubCategoryModal';
import CreateFormulationModal from '@/components/products/CreateFormulationModal';

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    product_code: '',
    product_name: '',
    generic_name: '',
    manufacturer: '',
    category_id: '',
    sub_category_id: '',
    formulation_id: '',
    unit_of_measure_smallest: 'Strip',
    base_cost_per_strip: '',
    is_active: true,
    storage_conditions: '',
    image_url: '',
    min_stock_level_godown: '',
    min_stock_level_mr: '',
    lead_time_days: '',
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
    if (!isEdit && !formData.product_code) {
      const lastCode = lastProductCode?.product_code || 'MAP00000';
      const lastNumber = parseInt(lastCode.substring(3)); // Remove 'MAP' prefix
      const nextNumber = lastNumber + 1;
      const newCode = `MAP${nextNumber.toString().padStart(5, '0')}`;
      setFormData(prev => ({ ...prev, product_code: newCode }));
    }
  }, [lastProductCode, isEdit]);

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

  // Set form data when product is loaded
  useEffect(() => {
    if (product) {
      setFormData({
        product_code: product.product_code || '',
        product_name: product.product_name || '',
        generic_name: product.generic_name || '',
        manufacturer: product.manufacturer || '',
        category_id: product.category_id || '',
        sub_category_id: product.sub_category_id || '',
        formulation_id: product.formulation_id || '',
        unit_of_measure_smallest: product.unit_of_measure_smallest || 'Strip',
        base_cost_per_strip: product.base_cost_per_strip?.toString() || '',
        is_active: product.is_active ?? true,
        storage_conditions: product.storage_conditions || '',
        image_url: product.image_url || '',
        min_stock_level_godown: product.min_stock_level_godown?.toString() || '',
        min_stock_level_mr: product.min_stock_level_mr?.toString() || '',
        lead_time_days: product.lead_time_days?.toString() || '',
      });
    }
  }, [product]);

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const productData = {
        ...data,
        base_cost_per_strip: parseFloat(data.base_cost_per_strip) || 0,
        min_stock_level_godown: parseInt(data.min_stock_level_godown) || 0,
        min_stock_level_mr: parseInt(data.min_stock_level_mr) || 0,
        lead_time_days: parseInt(data.lead_time_days) || 0,
        sub_category_id: data.sub_category_id || null,
      };

      if (isEdit) {
        const { data: result, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Product ${isEdit ? 'updated' : 'created'} successfully.`,
      });
      navigate('/admin/products');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${isEdit ? 'update' : 'create'} product: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.product_code || !formData.product_name || !formData.generic_name || 
        !formData.manufacturer || !formData.category_id || !formData.formulation_id) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    saveProductMutation.mutate(formData);
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleCategoryCreated = (categoryId: string) => {
    updateFormData({ category_id: categoryId, sub_category_id: '' });
  };

  const handleSubCategoryCreated = (subCategoryId: string) => {
    updateFormData({ sub_category_id: subCategoryId });
  };

  const handleFormulationCreated = (formulationId: string) => {
    updateFormData({ formulation_id: formulationId });
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
        <Button variant="ghost" onClick={() => navigate('/admin/products')}>
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                <TabsTrigger value="additional">Additional Information</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="mt-6">
                <BasicProductInfo 
                  formData={formData} 
                  updateFormData={updateFormData}
                  onCreateCategory={() => setIsCategoryModalOpen(true)}
                  onCreateSubCategory={() => setIsSubCategoryModalOpen(true)}
                  onCreateFormulation={() => setIsFormulationModalOpen(true)}
                />
              </TabsContent>
              
              <TabsContent value="additional" className="mt-6">
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
