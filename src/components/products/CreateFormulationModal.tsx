import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface CreateFormulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (formulationId: string) => void;
}

const CreateFormulationModal = ({ isOpen, onClose, onSuccess }: CreateFormulationModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    formulation_name: '',
    is_active: true,
  });

  const createFormulationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase
        .from('product_formulations')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-formulations'] });
      toast({
        title: "Success",
        description: "Formulation created successfully.",
      });
      onSuccess(data.id);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create formulation. Please try again.",
        variant: "destructive",
      });
    },
  });

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

    createFormulationMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Formulation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="formulation_name">Formulation Name *</Label>
            <Input
              id="formulation_name"
              value={formData.formulation_name}
              onChange={(e) => setFormData({ ...formData, formulation_name: e.target.value })}
              placeholder="Enter formulation name"
              required
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
            <Button type="submit" disabled={createFormulationMutation.isPending}>
              {createFormulationMutation.isPending ? 'Creating...' : 'Create Formulation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFormulationModal; 