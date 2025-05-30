
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StockReceiptsTableProps {
  receipts: any[];
  isLoading: boolean;
  onRefresh: () => void;
}

const StockReceiptsTable = ({ receipts, isLoading, onRefresh }: StockReceiptsTableProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<any>(null);

  // Delete receipt mutation
  const deleteReceiptMutation = useMutation({
    mutationFn: async (transactionGroupId: string) => {
      const { error } = await supabase
        .from('stock_transactions')
        .delete()
        .eq('transaction_group_id', transactionGroupId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock receipt deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-receipts'] });
      onRefresh();
      setDeleteConfirmOpen(false);
      setReceiptToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete stock receipt",
        variant: "destructive",
      });
      console.error('Error deleting receipt:', error);
    },
  });

  const handleView = (receipt: any) => {
    // Navigate to view receipt page
    navigate(`/admin/stock/receipts/${receipt.transaction_group_id}/view`);
  };

  const handleEdit = (receipt: any) => {
    // Navigate to edit receipt page
    navigate(`/admin/stock/receipts/${receipt.transaction_group_id}/edit`);
  };

  const handleDeleteClick = (receipt: any) => {
    setReceiptToDelete(receipt);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (receiptToDelete) {
      deleteReceiptMutation.mutate(receiptToDelete.transaction_group_id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500">Loading receipts...</div>
      </div>
    );
  }

  if (!receipts || receipts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500">No receipts found</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>GRN Number</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Receipt Date</TableHead>
            <TableHead>Created Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((receipt) => (
            <TableRow key={receipt.transaction_group_id}>
              <TableCell className="font-medium">
                {receipt.reference_document_id || '-'}
              </TableCell>
              <TableCell>{receipt.location_id_source || '-'}</TableCell>
              <TableCell>
                {receipt.transaction_date 
                  ? format(new Date(receipt.transaction_date), 'dd/MM/yyyy')
                  : '-'
                }
              </TableCell>
              <TableCell>
                {receipt.created_at 
                  ? format(new Date(receipt.created_at), 'dd/MM/yyyy HH:mm')
                  : '-'
                }
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1"
                    onClick={() => handleView(receipt)}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1"
                    onClick={() => handleEdit(receipt)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteClick(receipt)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stock receipt (GRN: {receiptToDelete?.reference_document_id})?
              This action cannot be undone and will remove all associated stock transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={deleteReceiptMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteReceiptMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockReceiptsTable;
