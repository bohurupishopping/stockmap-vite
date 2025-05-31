import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, X } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type PackagingTemplate = Database['public']['Tables']['packaging_templates']['Row'];

interface PackagingTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTemplate: PackagingTemplate | null;
}

const PackagingTemplateModal = ({
  isOpen,
  onClose,
  onSuccess,
  editingTemplate,
}: PackagingTemplateModalProps) => {
  const { toast } = useToast();
  const isEdit = !!editingTemplate;

  const [formData, setFormData] = useState({
    template_name: '',
    unit_name: '',
    conversion_factor_to_strips: 1,
    is_base_unit: false,
    order_in_hierarchy: 1,
  });

  useEffect(() => {
    if (editingTemplate) {
      setFormData({
        template_name: editingTemplate.template_name,
        unit_name: editingTemplate.unit_name,
        conversion_factor_to_strips: editingTemplate.conversion_factor_to_strips,
        is_base_unit: editingTemplate.is_base_unit,
        order_in_hierarchy: editingTemplate.order_in_hierarchy,
      });
    } else {
      setFormData({
        template_name: '',
        unit_name: '',
        conversion_factor_to_strips: 1,
        is_base_unit: false,
        order_in_hierarchy: 1,
      });
    }
  }, [editingTemplate]);

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (isEdit) {
        const { data: result, error } = await supabase
          .from('packaging_templates')
          .update({
            template_name: data.template_name,
            unit_name: data.unit_name,
            conversion_factor_to_strips: data.conversion_factor_to_strips,
            is_base_unit: data.is_base_unit,
            order_in_hierarchy: data.order_in_hierarchy,
          })
          .eq('id', editingTemplate!.id)
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from('packaging_templates')
          .insert({
            template_name: data.template_name,
            unit_name: data.unit_name,
            conversion_factor_to_strips: data.conversion_factor_to_strips,
            is_base_unit: data.is_base_unit,
            order_in_hierarchy: data.order_in_hierarchy,
          })
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Template ${isEdit ? 'updated' : 'created'} successfully.`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${isEdit ? 'update' : 'create'} template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.template_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Template name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.unit_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Unit name is required.",
        variant: "destructive",
      });
      return;
    }

    if (formData.conversion_factor_to_strips < 1) {
      toast({
        title: "Validation Error",
        description: "Conversion factor must be at least 1.",
        variant: "destructive",
      });
      return;
    }

    if (formData.order_in_hierarchy < 1) {
      toast({
        title: "Validation Error",
        description: "Order in hierarchy must be at least 1.",
        variant: "destructive",
      });
      return;
    }

    saveTemplateMutation.mutate(formData);
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Template Unit' : 'Add New Template Unit'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="template_name">Template Name *</Label>
            <Input
              id="template_name"
              value={formData.template_name}
              onChange={(e) => updateFormData({ template_name: e.target.value })}
              placeholder="e.g., Standard Pharma, Tablet Packaging"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Group name for related packaging units
            </p>
          </div>

          <div>
            <Label htmlFor="unit_name">Unit Name *</Label>
            <Input
              id="unit_name"
              value={formData.unit_name}
              onChange={(e) => updateFormData({ unit_name: e.target.value })}
              placeholder="e.g., Strip, Box, Carton"
              required
            />
          </div>

          <div>
            <Label htmlFor="conversion_factor">Strips in this Unit *</Label>
            <Input
              id="conversion_factor"
              type="number"
              min="1"
              value={formData.conversion_factor_to_strips}
              onChange={(e) => updateFormData({ conversion_factor_to_strips: parseInt(e.target.value) || 1 })}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              How many strips are in one {formData.unit_name || 'unit'}?
            </p>
          </div>

          <div>
            <Label htmlFor="order_hierarchy">Order in Hierarchy *</Label>
            <Input
              id="order_hierarchy"
              type="number"
              min="1"
              value={formData.order_in_hierarchy}
              onChange={(e) => updateFormData({ order_in_hierarchy: parseInt(e.target.value) || 1 })}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Lower numbers appear first (e.g., 1 for Strip, 2 for Box, 3 for Carton)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_base_unit"
              checked={formData.is_base_unit}
              onCheckedChange={(checked) => updateFormData({ is_base_unit: !!checked })}
            />
            <Label htmlFor="is_base_unit">Is Base Unit</Label>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saveTemplateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveTemplateMutation.isPending 
                ? (isEdit ? 'Updating...' : 'Creating...') 
                : (isEdit ? 'Update Template' : 'Create Template')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PackagingTemplateModal; 