import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProductCategory {
  id: string;
  category_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductSubCategory {
  id: string;
  sub_category_name: string;
  category_id: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_categories?: {
    id: string;
    category_name: string;
  };
}

const ProductCategories = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSubCategoryDialogOpen, setIsSubCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<ProductSubCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    category_name: '',
    description: '',
    is_active: true
  });
  const [subCategoryFormData, setSubCategoryFormData] = useState({
    sub_category_name: '',
    category_id: '',
    description: '',
    is_active: true
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['product-categories', searchTerm, activeFilter],
    queryFn: async () => {
      let query = supabase
        .from('product_categories')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('category_name', `%${searchTerm}%`);
      }

      if (activeFilter !== null) {
        query = query.eq('is_active', activeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch sub-categories
  const { data: subCategories = [], isLoading: isLoadingSubCategories } = useQuery({
    queryKey: ['product-sub-categories', searchTerm, activeFilter],
    queryFn: async () => {
      let query = supabase
        .from('product_sub_categories')
        .select(`
          *,
          product_categories (
            id,
            category_name
          )
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('sub_category_name', `%${searchTerm}%`);
      }

      if (activeFilter !== null) {
        query = query.eq('is_active', activeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (newCategory: Omit<ProductCategory, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('product_categories')
        .insert([newCategory])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setIsCategoryDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Category created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category.",
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      resetForm();
      toast({
        title: "Success",
        description: "Category updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category.",
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast({
        title: "Success",
        description: "Category deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category.",
        variant: "destructive",
      });
    },
  });

  // Create sub-category mutation
  const createSubCategoryMutation = useMutation({
    mutationFn: async (newSubCategory: Omit<ProductSubCategory, 'id' | 'created_at' | 'updated_at' | 'product_categories'>) => {
      const { data, error } = await supabase
        .from('product_sub_categories')
        .insert([newSubCategory])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sub-categories'] });
      setIsSubCategoryDialogOpen(false);
      resetSubCategoryForm();
      toast({
        title: "Success",
        description: "Sub-category created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sub-category.",
        variant: "destructive",
      });
    },
  });

  // Update sub-category mutation
  const updateSubCategoryMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductSubCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_sub_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sub-categories'] });
      setIsSubCategoryDialogOpen(false);
      setEditingSubCategory(null);
      resetSubCategoryForm();
      toast({
        title: "Success",
        description: "Sub-category updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update sub-category.",
        variant: "destructive",
      });
    },
  });

  // Delete sub-category mutation
  const deleteSubCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_sub_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sub-categories'] });
      toast({
        title: "Success",
        description: "Sub-category deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete sub-category.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCategoryFormData({
      category_name: '',
      description: '',
      is_active: true
    });
  };

  const resetSubCategoryForm = () => {
    setSubCategoryFormData({
      sub_category_name: '',
      category_id: '',
      description: '',
      is_active: true
    });
  };

  const handleEdit = (category: ProductCategory) => {
    setEditingCategory(category);
    setCategoryFormData({
      category_name: category.category_name,
      description: category.description || '',
      is_active: category.is_active
    });
    setIsCategoryDialogOpen(true);
  };

  const handleEditSubCategory = (subCategory: ProductSubCategory) => {
    setEditingSubCategory(subCategory);
    setSubCategoryFormData({
      sub_category_name: subCategory.sub_category_name,
      category_id: subCategory.category_id,
      description: subCategory.description || '',
      is_active: subCategory.is_active
    });
    setIsSubCategoryDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryFormData.category_name.trim()) {
      toast({
        title: "Error",
        description: "Category name is required.",
        variant: "destructive",
      });
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        ...categoryFormData
      });
    } else {
      createCategoryMutation.mutate(categoryFormData);
    }
  };

  const handleSubCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subCategoryFormData.sub_category_name.trim()) {
      toast({
        title: "Error",
        description: "Sub-category name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!subCategoryFormData.category_id) {
      toast({
        title: "Error",
        description: "Please select a category.",
        variant: "destructive",
      });
      return;
    }

    if (editingSubCategory) {
      updateSubCategoryMutation.mutate({
        id: editingSubCategory.id,
        ...subCategoryFormData
      });
    } else {
      createSubCategoryMutation.mutate(subCategoryFormData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleDeleteSubCategory = (id: string) => {
    if (window.confirm('Are you sure you want to delete this sub-category?')) {
      deleteSubCategoryMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingCategory(null);
    resetForm();
    setIsCategoryDialogOpen(true);
  };

  const handleAddNewSubCategory = () => {
    setEditingSubCategory(null);
    resetSubCategoryForm();
    setIsSubCategoryDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Categories</h1>
        <p className="text-gray-600">Manage your product categories and sub-categories</p>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="subcategories">Sub-Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-6">
          {/* Categories Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <select
                value={activeFilter === null ? 'all' : activeFilter.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setActiveFilter(value === 'all' ? null : value === 'true');
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Categories</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>

            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingCategory(null); resetForm(); setIsCategoryDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Category
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCategory 
                      ? 'Update the category details below.' 
                      : 'Fill in the details to create a new product category.'
                    }
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label htmlFor="category_name" className="text-sm font-medium">
                        Category Name *
                      </label>
                      <Input
                        id="category_name"
                        value={categoryFormData.category_name}
                        onChange={(e) => setCategoryFormData(prev => ({ ...prev, category_name: e.target.value }))}
                        placeholder="Enter category name"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="description" className="text-sm font-medium">
                        Description
                      </label>
                      <Textarea
                        id="description"
                        value={categoryFormData.description}
                        onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter category description"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={categoryFormData.is_active}
                        onCheckedChange={(checked) => setCategoryFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <label htmlFor="is_active" className="text-sm font-medium">
                        Active Category
                      </label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCategoryDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                    >
                      {editingCategory ? 'Update' : 'Create'} Category
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Categories Table */}
          <div className="bg-white rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Updated At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Loading categories...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No categories found. Create your first category to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.category_name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {category.description || '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          category.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {category.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(category.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(category.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(category.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="subcategories" className="space-y-6">
          {/* Sub-Categories Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search sub-categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <select
                value={activeFilter === null ? 'all' : activeFilter.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setActiveFilter(value === 'all' ? null : value === 'true');
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Sub-Categories</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>

            <Dialog open={isSubCategoryDialogOpen} onOpenChange={setIsSubCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNewSubCategory} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Sub-Category
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingSubCategory ? 'Edit Sub-Category' : 'Add New Sub-Category'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingSubCategory 
                      ? 'Update the sub-category details below.' 
                      : 'Fill in the details to create a new product sub-category.'
                    }
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubCategorySubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label htmlFor="sub_category_name" className="text-sm font-medium">
                        Sub-Category Name *
                      </label>
                      <Input
                        id="sub_category_name"
                        value={subCategoryFormData.sub_category_name}
                        onChange={(e) => setSubCategoryFormData(prev => ({ ...prev, sub_category_name: e.target.value }))}
                        placeholder="Enter sub-category name"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="category_id" className="text-sm font-medium">
                        Parent Category *
                      </label>
                      <Select 
                        value={subCategoryFormData.category_id} 
                        onValueChange={(value) => setSubCategoryFormData(prev => ({ ...prev, category_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.filter(cat => cat.is_active).map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.category_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="sub_description" className="text-sm font-medium">
                        Description
                      </label>
                      <Textarea
                        id="sub_description"
                        value={subCategoryFormData.description}
                        onChange={(e) => setSubCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter sub-category description"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="sub_is_active"
                        checked={subCategoryFormData.is_active}
                        onCheckedChange={(checked) => setSubCategoryFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <label htmlFor="sub_is_active" className="text-sm font-medium">
                        Active Sub-Category
                      </label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSubCategoryDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createSubCategoryMutation.isPending || updateSubCategoryMutation.isPending}
                    >
                      {editingSubCategory ? 'Update' : 'Create'} Sub-Category
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Sub-Categories Table */}
          <div className="bg-white rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sub-Category Name</TableHead>
                  <TableHead>Parent Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSubCategories ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Loading sub-categories...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : subCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No sub-categories found. Create your first sub-category to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  subCategories.map((subCategory) => (
                    <TableRow key={subCategory.id}>
                      <TableCell className="font-medium">{subCategory.sub_category_name}</TableCell>
                      <TableCell>{subCategory.product_categories?.category_name || '—'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {subCategory.description || '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          subCategory.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {subCategory.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(subCategory.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSubCategory(subCategory)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSubCategory(subCategory.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductCategories;
