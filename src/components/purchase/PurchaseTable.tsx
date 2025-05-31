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
import { Tables } from '@/integrations/supabase/types';

interface StockPurchaseItem {
  purchase_id: string;
  purchase_group_id: string;
  product_id: string;
  batch_id: string;
  quantity_strips: number;
  supplier_id: string | null;
  purchase_date: string;
  reference_document_id: string | null;
  cost_per_strip: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  // Joined fields
  product_name?: string;
  product_code?: string;
  batch_number?: string;
  expiry_date?: string;
}

interface StockPurchaseGroup {
  purchase_group_id: string;
  reference_document_id: string | null;
  purchase_date: string;
  supplier_id: string | null;
  created_at: string;
  created_by: string | null;
  items: StockPurchaseItem[];
}

interface StockPurchaseTableProps {
  purchases: StockPurchaseGroup[];
  isLoading: boolean;
  onRefresh: () => void;
  onView?: (purchaseId: string) => void;
  onEdit?: (purchaseId: string) => void;
}

const StockPurchaseTable = ({ purchases, isLoading, onRefresh, onView, onEdit }: StockPurchaseTableProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<StockPurchaseGroup | null>(null);

  // Delete receipt mutation
  const deleteReceiptMutation = useMutation({
    mutationFn: async (purchaseGroupId: string) => {
      const { error } = await supabase
        .from('stock_purchases')
        .delete()
        .eq('purchase_group_id', purchaseGroupId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock purchase deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
      onRefresh();
      setDeleteConfirmOpen(false);
      setPurchaseToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete stock purchase",
        variant: "destructive",
      });
      console.error('Error deleting purchase:', error);
    },
  });

  const handleView = (purchase: StockPurchaseGroup) => {
    if (onView) {
      onView(purchase.purchase_group_id);
    } else {
      // Fallback to navigation if onView prop is not provided
      navigate(`/admin/stock/purchase/${purchase.purchase_group_id}/view`);
    }
  };

  const handleEdit = (purchase: StockPurchaseGroup) => {
    if (onEdit) {
      onEdit(purchase.purchase_group_id);
    } else {
      // Fallback to navigation if onEdit prop is not provided
      navigate(`/admin/stock/purchase/${purchase.purchase_group_id}/edit`);
    }
  };

  const handleDeleteClick = (purchase: StockPurchaseGroup) => {
    setPurchaseToDelete(purchase);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (purchaseToDelete) {
      deleteReceiptMutation.mutate(purchaseToDelete.purchase_group_id);
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>GRN Number</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Cost/Strip</TableHead>
            <TableHead>Purchase Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2">Loading purchases...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : !purchases || purchases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No purchases found. Create your first purchase to get started.
              </TableCell>
            </TableRow>
          ) : (
            purchases.flatMap((purchase) => 
              purchase.items.map((item, itemIndex) => (
                <TableRow key={`${purchase.purchase_group_id}-${itemIndex}`}>
                  {itemIndex === 0 ? (
                    <>
                      <TableCell className="font-medium" rowSpan={purchase.items.length}>
                        {purchase.reference_document_id || '-'}
                      </TableCell>
                      <TableCell rowSpan={purchase.items.length}>
                        {purchase.supplier_id || '-'}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.product_name || '-'}</p>
                      <p className="text-xs text-gray-500">{item.product_code || '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.batch_number || '-'}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      STOCK_IN_GODOWN
                    </span>
                  </TableCell>
                  <TableCell>{item.quantity_strips.toLocaleString()} strips</TableCell>
                  <TableCell>₹{item.cost_per_strip.toFixed(2)}</TableCell>
                  <TableCell>
                    {purchase.purchase_date 
                      ? format(new Date(purchase.purchase_date), 'dd/MM/yyyy')
                      : '-'
                    }
                  </TableCell>
                  {itemIndex === 0 ? (
                    <TableCell rowSpan={purchase.items.length}>
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 rounded-full"
                          onClick={() => handleView(purchase)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 rounded-full"
                          onClick={() => handleEdit(purchase)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 rounded-full text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteClick(purchase)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )
          )}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stock purchase (GRN: {purchaseToDelete?.reference_document_id})?
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

export default StockPurchaseTable;
