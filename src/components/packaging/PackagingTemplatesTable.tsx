import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type PackagingTemplate = Database['public']['Tables']['packaging_templates']['Row'];

interface PackagingTemplatesTableProps {
  templates: Record<string, PackagingTemplate[]>;
  isLoading: boolean;
  onEdit: (template: PackagingTemplate) => void;
  onRefresh: () => void;
}

const PackagingTemplatesTable = ({
  templates,
  isLoading,
  onEdit,
  onRefresh,
}: PackagingTemplatesTableProps) => {
  const { toast } = useToast();

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('packaging_templates')
        .delete()
        .eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template deleted successfully.",
      });
      onRefresh();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleDelete = async (template: PackagingTemplate) => {
    if (template.is_base_unit) {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete the base unit of a template. Please delete the entire template group or edit it.",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete this packaging unit template?`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p>Loading templates...</p>
      </div>
    );
  }

  if (Object.keys(templates).length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No templates found. Add your first template to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(templates).map(([templateName, units]) => (
        <div key={templateName} className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{templateName}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit Name</TableHead>
                <TableHead>Strips in Unit</TableHead>
                <TableHead>Is Base Unit?</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.unit_name}</TableCell>
                  <TableCell>{unit.conversion_factor_to_strips}</TableCell>
                  <TableCell>
                    <Badge variant={unit.is_base_unit ? "default" : "secondary"}>
                      {unit.is_base_unit ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>{unit.order_in_hierarchy}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(unit)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(unit)}
                        className="text-red-600 hover:text-red-700"
                        disabled={deleteTemplateMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
};

export default PackagingTemplatesTable; 