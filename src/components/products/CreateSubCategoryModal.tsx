import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface CreateSubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subCategoryId: string) => void;
  categoryId: string;
}

const CreateSubCategoryModal = ({ isOpen, onClose, onSuccess, categoryId }: CreateSubCategoryModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    sub_category_name: '',
    description: '',
    is_active: true,
  });

  const createSubCategoryMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase
        .from('product_sub_categories')
        .insert({
          ...data,
          category_id: categoryId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-sub-categories', categoryId] });
      toast({
        title: "Success",
        description: "Sub-category created successfully.",
      });
      onSuccess(data.id);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create sub-category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sub_category_name.trim()) {
      toast({
        title: "Error",
        description: "Sub-category name is required.",
        variant: "destructive",
      });
      return;
    }

    createSubCategoryMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Sub-Category</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sub_category_name">Sub-Category Name *</Label>
            <Input
              id="sub_category_name"
              value={formData.sub_category_name}
              onChange={(e) => setFormData({ ...formData, sub_category_name: e.target.value })}
              placeholder="Enter sub-category name"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter sub-category description"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSubCategoryMutation.isPending}>
              {createSubCategoryMutation.isPending ? 'Creating...' : 'Create Sub-Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSubCategoryModal; 