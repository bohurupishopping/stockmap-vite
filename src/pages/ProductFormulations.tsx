import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface ProductFormulation {
  id: string;
  formulation_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ProductFormulations = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormulation, setEditingFormulation] = useState<ProductFormulation | null>(null);
  const [formData, setFormData] = useState({
    formulation_name: '',
    is_active: true
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch formulations
  const { data: formulations = [], isLoading } = useQuery({
    queryKey: ['product-formulations', searchTerm, activeFilter],
    queryFn: async () => {
      let query = supabase
        .from('product_formulations')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('formulation_name', `%${searchTerm}%`);
      }

      if (activeFilter !== null) {
        query = query.eq('is_active', activeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Create formulation mutation
  const createFormulationMutation = useMutation({
    mutationFn: async (newFormulation: Omit<ProductFormulation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('product_formulations')
        .insert([newFormulation])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-formulations'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Formulation created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create formulation.",
        variant: "destructive",
      });
    },
  });

  // Update formulation mutation
  const updateFormulationMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductFormulation> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_formulations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-formulations'] });
      setIsDialogOpen(false);
      setEditingFormulation(null);
      resetForm();
      toast({
        title: "Success",
        description: "Formulation updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update formulation.",
        variant: "destructive",
      });
    },
  });

  // Delete formulation mutation
  const deleteFormulationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_formulations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-formulations'] });
      toast({
        title: "Success",
        description: "Formulation deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete formulation.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      formulation_name: '',
      is_active: true
    });
  };

  const handleEdit = (formulation: ProductFormulation) => {
    setEditingFormulation(formulation);
    setFormData({
      formulation_name: formulation.formulation_name,
      is_active: formulation.is_active
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.formulation_name.trim()) {
      toast({
        title: "Error",
        description: "Formulation name is required.",
        variant: "destructive",
      });
      return;
    }

    if (editingFormulation) {
      updateFormulationMutation.mutate({
        id: editingFormulation.id,
        ...formData
      });
    } else {
      createFormulationMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this formulation?')) {
      deleteFormulationMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingFormulation(null);
    resetForm();
    setIsDialogOpen(true);
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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Formulations</h1>
          <p className="text-gray-600">Manage your product formulations and their properties</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-40 rounded-full border-0 focus-visible:ring-1"
              />
            </div>
            
            <select
              value={activeFilter === null ? 'all' : activeFilter.toString()}
              onChange={(e) => {
                const value = e.target.value;
                setActiveFilter(value === 'all' ? null : value === 'true');
              }}
              className="h-8 px-2 rounded-full text-sm bg-white border-0 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew} 
                className="h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-full text-sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Formulation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingFormulation ? 'Edit Formulation' : 'Add New Formulation'}
                </DialogTitle>
                <DialogDescription>
                  {editingFormulation 
                    ? 'Update the formulation details below.' 
                    : 'Fill in the details to create a new product formulation.'
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="formulation_name" className="text-sm font-medium">
                      Formulation Name *
                    </label>
                    <Input
                      id="formulation_name"
                      value={formData.formulation_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, formulation_name: e.target.value }))}
                      placeholder="Enter formulation name"
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <label htmlFor="is_active" className="text-sm font-medium">
                      Active Formulation
                    </label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createFormulationMutation.isPending || updateFormulationMutation.isPending}
                  >
                    {editingFormulation ? 'Update' : 'Create'} Formulation
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Formulations Table */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Formulation Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Updated At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Loading formulations...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : formulations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No formulations found. Create your first formulation to get started.
                </TableCell>
              </TableRow>
            ) : (
              formulations.map((formulation) => (
                <TableRow key={formulation.id}>
                  <TableCell className="font-medium">{formulation.formulation_name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      formulation.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {formulation.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(formulation.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(formulation.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(formulation)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(formulation.id)}
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
    </div>
  );
};

export default ProductFormulations;
