
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProductBatch } from '@/components/products/ProductBatches';
import { useQuery } from '@tanstack/react-query';

interface BatchesTableProps {
  batches: ProductBatch[];
  isLoading: boolean;
  onEdit: (batch: ProductBatch) => void;
  onRefresh: () => void;
  productId: string;
  baseCostPerStrip: number;
}

const BatchesTable = ({ batches, isLoading, onEdit, onRefresh, baseCostPerStrip }: BatchesTableProps) => {
  const { toast } = useToast();

  // Fetch stock summary for each batch
  const { data: stockData } = useQuery({
    queryKey: ['batch-stock-summary', batches.map(b => b.id)],
    queryFn: async () => {
      if (batches.length === 0) return {};
      
      const batchIds = batches.map(b => b.id);
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('batch_id, quantity_strips')
        .in('batch_id', batchIds);
      
      if (error) throw error;
      
      // Calculate total stock for each batch
      const stockSummary: Record<string, number> = {};
      data.forEach(transaction => {
        if (!stockSummary[transaction.batch_id]) {
          stockSummary[transaction.batch_id] = 0;
        }
        stockSummary[transaction.batch_id] += transaction.quantity_strips;
      });
      
      return stockSummary;
    },
    enabled: batches.length > 0,
  });

  const handleDelete = async (batchId: string) => {
    if (window.confirm('Are you sure you want to delete this batch?')) {
      const { error } = await supabase
        .from('product_batches')
        .delete()
        .eq('id', batchId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete batch.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Batch deleted successfully.",
        });
        onRefresh();
      }
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Active':
        return 'default';
      case 'Expired':
        return 'destructive';
      case 'Recalled':
        return 'destructive';
      case 'Quarantined':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        Loading batches...
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-8">
        No batches found for this product.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch Number</TableHead>
            <TableHead>Manufacturing Date</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Batch Cost/Strip</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Updated At</TableHead>
            <TableHead>Current Stock</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell className="font-mono text-sm">
                {batch.batch_number}
              </TableCell>
              <TableCell>
                {formatDate(batch.manufacturing_date)}
              </TableCell>
              <TableCell>
                {formatDate(batch.expiry_date)}
              </TableCell>
              <TableCell className="font-mono">
                {batch.batch_cost_per_strip 
                  ? `₹${batch.batch_cost_per_strip}` 
                  : `₹${baseCostPerStrip} (Base)`
                }
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(batch.status)}>
                  {batch.status}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {batch.notes || '-'}
              </TableCell>
              <TableCell>
                {formatDate(batch.created_at)}
              </TableCell>
              <TableCell>
                {formatDate(batch.updated_at)}
              </TableCell>
              <TableCell className="text-center">
                <span className="font-mono">
                  {stockData?.[batch.id] || 0} strips
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEdit(batch)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDelete(batch.id)}
                    className="text-red-600 hover:text-red-700"
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

export default BatchesTable;
