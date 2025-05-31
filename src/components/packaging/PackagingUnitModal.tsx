import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X } from 'lucide-react';
import { ProductPackagingUnit } from '@/components/products/ProductPackaging';
import { Database } from '@/integrations/supabase/types';

type PackagingTemplate = Database['public']['Tables']['packaging_templates']['Row'];

interface PackagingUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingUnit: ProductPackagingUnit | null;
  productId: string;
  product: {
    id: string;
    product_name: string;
    product_code: string;
  };
}

const PackagingUnitModal = ({
  isOpen,
  onClose,
  onSuccess,
  editingUnit,
  productId,
  product
}: PackagingUnitModalProps) => {
  const { toast } = useToast();
  const isEdit = !!editingUnit;

  const [formData, setFormData] = useState({
    unit_name: '',
    conversion_factor_to_strips: 1,
    is_base_unit: false,
    order_in_hierarchy: 1,
    default_purchase_unit: false,
    default_sales_unit_mr: false,
    default_sales_unit_direct: false,
    template_id: null as string | null,
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
    enabled: isOpen,
  });

  // Group templates by template_name
  const groupedTemplates = packagingTemplates?.reduce((acc, template) => {
    if (!acc[template.template_name]) {
      acc[template.template_name] = [];
    }
    acc[template.template_name].push(template);
    return acc;
  }, {} as Record<string, PackagingTemplate[]>) ?? {};

  // Get the product's base unit info
  const { data: baseUnit } = useQuery({
    queryKey: ['base-unit', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_packaging_units')
        .select('unit_name')
        .eq('product_id', productId)
        .eq('is_base_unit', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Get next order number
  const { data: nextOrder } = useQuery({
    queryKey: ['next-order', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_packaging_units')
        .select('order_in_hierarchy')
        .eq('product_id', productId)
        .order('order_in_hierarchy', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? data.order_in_hierarchy + 1 : 1;
    },
    enabled: isOpen && !isEdit,
  });

  useEffect(() => {
    if (editingUnit) {
      setFormData({
        unit_name: editingUnit.unit_name,
        conversion_factor_to_strips: editingUnit.conversion_factor_to_strips,
        is_base_unit: editingUnit.is_base_unit,
        order_in_hierarchy: editingUnit.order_in_hierarchy,
        default_purchase_unit: editingUnit.default_purchase_unit,
        default_sales_unit_mr: editingUnit.default_sales_unit_mr,
        default_sales_unit_direct: editingUnit.default_sales_unit_direct,
        template_id: editingUnit.template_id,
      });
    } else {
      setFormData({
        unit_name: '',
        conversion_factor_to_strips: 1,
        is_base_unit: !baseUnit,
        order_in_hierarchy: nextOrder || 1,
        default_purchase_unit: false,
        default_sales_unit_mr: false,
        default_sales_unit_direct: false,
        template_id: null,
      });
    }
  }, [editingUnit, baseUnit, nextOrder]);

  const handleTemplateSelect = (templateId: string) => {
    const template = packagingTemplates?.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        template_id: template.id,
        unit_name: template.unit_name,
        conversion_factor_to_strips: template.conversion_factor_to_strips,
        is_base_unit: template.is_base_unit,
        order_in_hierarchy: template.order_in_hierarchy,
      }));
    }
  };

  const saveUnitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const unitData = {
        product_id: productId,
        unit_name: data.unit_name,
        conversion_factor_to_strips: data.conversion_factor_to_strips,
        is_base_unit: data.is_base_unit,
        order_in_hierarchy: data.order_in_hierarchy,
        default_purchase_unit: data.default_purchase_unit,
        default_sales_unit_mr: data.default_sales_unit_mr,
        default_sales_unit_direct: data.default_sales_unit_direct,
        template_id: data.template_id,
      };

      if (isEdit) {
        const { data: result, error } = await supabase
          .from('product_packaging_units')
          .update(unitData)
          .eq('id', editingUnit!.id)
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from('product_packaging_units')
          .insert(unitData)
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Packaging unit ${isEdit ? 'updated' : 'created'} successfully.`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${isEdit ? 'update' : 'create'} packaging unit: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
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

    saveUnitMutation.mutate(formData);
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const baseUnitName = baseUnit?.unit_name || 'Strip';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Packaging Unit' : 'Add New Packaging Unit'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div>
              <Label>Use Template (Optional)</Label>
              <Select
                value={formData.template_id || ''}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedTemplates).map(([templateName, templates]) => (
                    <div key={templateName}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {templateName}
                      </div>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.unit_name} ({template.conversion_factor_to_strips} strips)
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="unit_name">Unit Name *</Label>
            <Input
              id="unit_name"
              value={formData.unit_name}
              onChange={(e) => updateFormData({ unit_name: e.target.value })}
              placeholder="e.g., Box, Carton, Pack"
              required
            />
          </div>

          <div>
            <Label htmlFor="conversion_factor">
              {baseUnitName}s in this Unit (Conversion Factor) *
            </Label>
            <Input
              id="conversion_factor"
              type="number"
              min="1"
              value={formData.conversion_factor_to_strips}
              onChange={(e) => updateFormData({ conversion_factor_to_strips: parseInt(e.target.value) || 1 })}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              How many {baseUnitName}s are in one {formData.unit_name || 'unit'}?
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
              Lower numbers appear first (e.g., 1 for {baseUnitName}, 2 for Box, 3 for Carton)
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_base_unit"
                checked={formData.is_base_unit}
                onCheckedChange={(checked) => updateFormData({ is_base_unit: !!checked })}
                disabled={baseUnit && !editingUnit?.is_base_unit}
              />
              <Label htmlFor="is_base_unit">Is Base Unit</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="default_purchase_unit"
                checked={formData.default_purchase_unit}
                onCheckedChange={(checked) => updateFormData({ default_purchase_unit: !!checked })}
              />
              <Label htmlFor="default_purchase_unit">Default Purchase Unit</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="default_sales_unit_mr"
                checked={formData.default_sales_unit_mr}
                onCheckedChange={(checked) => updateFormData({ default_sales_unit_mr: !!checked })}
              />
              <Label htmlFor="default_sales_unit_mr">Default MR Sales Unit</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="default_sales_unit_direct"
                checked={formData.default_sales_unit_direct}
                onCheckedChange={(checked) => updateFormData({ default_sales_unit_direct: !!checked })}
              />
              <Label htmlFor="default_sales_unit_direct">Default Direct Sales Unit</Label>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saveUnitMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveUnitMutation.isPending 
                ? (isEdit ? 'Updating...' : 'Creating...') 
                : (isEdit ? 'Update Unit' : 'Create Unit')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PackagingUnitModal;
