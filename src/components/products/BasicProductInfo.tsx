import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type PackagingTemplate = Database['public']['Tables']['packaging_templates']['Row'];

interface BasicProductInfoProps {
  formData: any;
  updateFormData: (updates: any) => void;
  onCreateCategory: () => void;
  onCreateSubCategory: () => void;
  onCreateFormulation: () => void;
}

const BasicProductInfo = ({ 
  formData, 
  updateFormData,
  onCreateCategory,
  onCreateSubCategory,
  onCreateFormulation,
}: BasicProductInfoProps) => {
  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('category_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch packaging templates
  const { data: packagingTemplates } = useQuery({
    queryKey: ['packaging-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_templates')
        .select('*')
        .order('template_name', { ascending: true })
        .order('order_in_hierarchy', { ascending: true });
      if (error) throw error;
      return data as PackagingTemplate[];
    },
  });

  // Group templates by template_name
  const groupedTemplates = packagingTemplates?.reduce((acc, template) => {
    if (!acc[template.template_name]) {
      acc[template.template_name] = [];
    }
    acc[template.template_name].push(template);
    return acc;
  }, {} as Record<string, PackagingTemplate[]>) ?? {};

  // Fetch sub-categories based on selected category
  const { data: subCategories } = useQuery({
    queryKey: ['product-sub-categories', formData.category_id],
    queryFn: async () => {
      if (!formData.category_id) return [];
      const { data, error } = await supabase
        .from('product_sub_categories')
        .select('*')
        .eq('category_id', formData.category_id)
        .eq('is_active', true)
        .order('sub_category_name');
      if (error) throw error;
      return data;
    },
    enabled: !!formData.category_id,
  });

  // Fetch formulations
  const { data: formulations } = useQuery({
    queryKey: ['product-formulations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_formulations')
        .select('*')
        .eq('is_active', true)
        .order('formulation_name');
      if (error) throw error;
      return data;
    },
  });

  const handleCategoryChange = (categoryId: string) => {
    updateFormData({ 
      category_id: categoryId, 
      sub_category_id: '' // Reset sub-category when category changes
    });
  };

  const handleSubCategoryChange = (value: string) => {
    // Convert "none" back to empty string for the database
    const subCategoryId = value === "none" ? '' : value;
    updateFormData({ sub_category_id: subCategoryId });
  };

  const handleTemplateChange = (templateName: string) => {
    if (!packagingTemplates) return;

    // Find all units for this template
    const templateUnits = packagingTemplates.filter(t => t.template_name === templateName);
    
    // Update form data with the selected template units
    updateFormData({ 
      selected_packaging_template_name: templateName,
      packaging_units: templateUnits.map(unit => ({
        unit_name: unit.unit_name,
        conversion_factor_to_strips: unit.conversion_factor_to_strips,
        is_base_unit: unit.is_base_unit,
        order_in_hierarchy: unit.order_in_hierarchy,
        template_id: unit.id,
        // Set reasonable defaults for the other fields
        default_purchase_unit: unit.order_in_hierarchy === 2, // Usually the second unit (e.g., Box)
        default_sales_unit_mr: unit.order_in_hierarchy === 2, // Usually the second unit
        default_sales_unit_direct: unit.order_in_hierarchy === 1, // Usually the base unit
      }))
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="product_code">Product Code *</Label>
          <Input
            id="product_code"
            value={formData.product_code}
            onChange={(e) => updateFormData({ product_code: e.target.value })}
            placeholder="Auto-generated product code"
            required
            readOnly
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-500">Auto-generated unique product code</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product_name">Product Name (Brand Name) *</Label>
          <Input
            id="product_name"
            value={formData.product_name}
            onChange={(e) => updateFormData({ product_name: e.target.value })}
            placeholder="Enter product brand name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="generic_name">Generic Name (Active Ingredient) *</Label>
          <Input
            id="generic_name"
            value={formData.generic_name}
            onChange={(e) => updateFormData({ generic_name: e.target.value })}
            placeholder="Enter generic/active ingredient name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="manufacturer">Manufacturer *</Label>
          <Input
            id="manufacturer"
            value={formData.manufacturer}
            onChange={(e) => updateFormData({ manufacturer: e.target.value })}
            placeholder="Enter manufacturer name"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="category">Category *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCreateCategory}
              className="h-6 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              New
            </Button>
          </div>
          <Select value={formData.category_id} onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.category_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sub_category">Sub-Category</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCreateSubCategory}
              className="h-6 px-2"
              disabled={!formData.category_id}
            >
              <Plus className="h-3 w-3 mr-1" />
              New
            </Button>
          </div>
          <Select 
            value={formData.sub_category_id || "none"} 
            onValueChange={handleSubCategoryChange}
            disabled={!formData.category_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a sub-category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No sub-category</SelectItem>
              {subCategories?.map((subCategory) => (
                <SelectItem key={subCategory.id} value={subCategory.id}>
                  {subCategory.sub_category_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="formulation">Formulation *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCreateFormulation}
              className="h-6 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              New
            </Button>
          </div>
          <Select value={formData.formulation_id} onValueChange={(value) => updateFormData({ formulation_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select a formulation" />
            </SelectTrigger>
            <SelectContent>
              {formulations?.map((formulation) => (
                <SelectItem key={formulation.id} value={formulation.id}>
                  {formulation.formulation_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="packaging_template">Packaging Template</Label>
          <Select value={formData.selected_packaging_template_name || ''} onValueChange={handleTemplateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a packaging template" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(groupedTemplates).map((templateName) => (
                <SelectItem key={templateName} value={templateName}>
                  {templateName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            Select a template to automatically set up packaging units
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit_of_measure">Smallest Unit of Measure</Label>
          <Input
            id="unit_of_measure"
            value={formData.unit_of_measure_smallest}
            onChange={(e) => updateFormData({ unit_of_measure_smallest: e.target.value })}
            placeholder="Strip"
            readOnly
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-500">Currently fixed to "Strip"</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="base_cost">Base Cost per Smallest Unit (₹) *</Label>
          <Input
            id="base_cost"
            type="number"
            min="0"
            step="0.01"
            value={formData.base_cost_per_strip}
            onChange={(e) => updateFormData({ base_cost_per_strip: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => updateFormData({ is_active: checked })}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="is_active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Product is Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Active products are available for ordering and stock management
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BasicProductInfo;
