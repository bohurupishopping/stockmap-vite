
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ProductFiltersProps {
  filters: {
    category: string;
    subCategory: string;
    formulation: string;
    manufacturer: string;
    isActive: string;
  };
  setFilters: (filters: any) => void;
}

const ProductFilters = ({ filters, setFilters }: ProductFiltersProps) => {
  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['product-categories-filter'],
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

  // Fetch sub-categories based on selected category
  const { data: subCategories } = useQuery({
    queryKey: ['product-sub-categories-filter', filters.category],
    queryFn: async () => {
      if (!filters.category || filters.category === 'all_categories') return [];
      const { data, error } = await supabase
        .from('product_sub_categories')
        .select('*')
        .eq('category_id', filters.category)
        .eq('is_active', true)
        .order('sub_category_name');
      if (error) throw error;
      return data;
    },
    enabled: !!filters.category && filters.category !== 'all_categories',
  });

  // Fetch formulations
  const { data: formulations } = useQuery({
    queryKey: ['product-formulations-filter'],
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

  const updateFilter = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    // Reset sub-category when category changes
    if (key === 'category' && filters.subCategory) {
      setFilters({ ...filters, [key]: value, subCategory: 'all_subcategories' });
    }
  };

  const clearAllFilters = () => {
    setFilters({
      category: 'all_categories',
      subCategory: 'all_subcategories',
      formulation: 'all_formulations',
      manufacturer: '',
      isActive: 'all_statuses',
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <Select value={filters.category} onValueChange={(value) => updateFilter('category', value)}>
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_categories">All categories</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Category</label>
        <Select 
          value={filters.subCategory} 
          onValueChange={(value) => updateFilter('subCategory', value)}
          disabled={!filters.category || filters.category === 'all_categories'}
        >
          <SelectTrigger>
            <SelectValue placeholder="All sub-categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_subcategories">All sub-categories</SelectItem>
            {subCategories?.map((subCategory) => (
              <SelectItem key={subCategory.id} value={subCategory.id}>
                {subCategory.sub_category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Formulation</label>
        <Select value={filters.formulation} onValueChange={(value) => updateFilter('formulation', value)}>
          <SelectTrigger>
            <SelectValue placeholder="All formulations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_formulations">All formulations</SelectItem>
            {formulations?.map((formulation) => (
              <SelectItem key={formulation.id} value={formulation.id}>
                {formulation.formulation_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
        <Input
          placeholder="Enter manufacturer"
          value={filters.manufacturer}
          onChange={(e) => updateFilter('manufacturer', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <Select value={filters.isActive} onValueChange={(value) => updateFilter('isActive', value)}>
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_statuses">All statuses</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end">
        <Button variant="outline" onClick={clearAllFilters} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Clear All
        </Button>
      </div>
    </div>
  );
};

export default ProductFilters;
