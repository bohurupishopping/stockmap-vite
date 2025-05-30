
import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { ProductPackagingUnit } from '@/components/products/ProductPackaging';

interface PackagingUnitsTableProps {
  packagingUnits: ProductPackagingUnit[];
  isLoading: boolean;
  onEdit: (unit: ProductPackagingUnit) => void;
  onRefresh: () => void;
  productId: string;
}

const PackagingUnitsTable = ({ 
  packagingUnits, 
  isLoading, 
  onEdit, 
  onRefresh, 
  productId 
}: PackagingUnitsTableProps) => {
  const { toast } = useToast();

  const deleteUnitMutation = useMutation({
    mutationFn: async (unitId: string) => {
      const { error } = await supabase
        .from('product_packaging_units')
        .delete()
        .eq('id', unitId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Packaging unit deleted successfully.",
      });
      onRefresh();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete packaging unit: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (unit: ProductPackagingUnit) => {
    if (unit.is_base_unit) {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete the base unit. Please set another unit as base first.",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete the packaging unit "${unit.unit_name}"?`)) {
      deleteUnitMutation.mutate(unit.id);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p>Loading packaging units...</p>
      </div>
    );
  }

  if (packagingUnits.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No packaging units found. Add your first packaging unit to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unit Name</TableHead>
            <TableHead>Strips in this Unit</TableHead>
            <TableHead>Is Base Unit?</TableHead>
            <TableHead>Hierarchy Order</TableHead>
            <TableHead>Default Purchase?</TableHead>
            <TableHead>Default MR Sales?</TableHead>
            <TableHead>Default Direct Sales?</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packagingUnits.map((unit) => (
            <TableRow key={unit.id}>
              <TableCell className="font-medium">{unit.unit_name}</TableCell>
              <TableCell>{unit.conversion_factor_to_strips}</TableCell>
              <TableCell>
                <Badge variant={unit.is_base_unit ? "default" : "secondary"}>
                  {unit.is_base_unit ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell>{unit.order_in_hierarchy}</TableCell>
              <TableCell>
                <Badge variant={unit.default_purchase_unit ? "default" : "secondary"}>
                  {unit.default_purchase_unit ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={unit.default_sales_unit_mr ? "default" : "secondary"}>
                  {unit.default_sales_unit_mr ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={unit.default_sales_unit_direct ? "default" : "secondary"}>
                  {unit.default_sales_unit_direct ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
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
                    disabled={deleteUnitMutation.isPending}
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
  );
};

export default PackagingUnitsTable;
