import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { StockTransaction } from '@/pages/StockMovements';

interface StockTransactionsTableProps {
  transactions: StockTransaction[];
  isLoading: boolean;
  onEdit: (transaction: StockTransaction) => void;
  onRefresh: () => void;
}

const StockTransactionsTable = ({ transactions, isLoading, onEdit, onRefresh }: StockTransactionsTableProps) => {
  const { toast } = useToast();

  const handleDelete = async (transactionId: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      // First determine the transaction type to know which table to delete from
      const { data: transactionData, error: fetchError } = await supabase
        .from('stock_transactions_view')
        .select('transaction_id, reference_document_type')
        .eq('transaction_id', transactionId)
        .single();
      
      if (fetchError) {
        toast({
          title: "Error",
          description: "Failed to fetch transaction details.",
          variant: "destructive",
        });
        return;
      }
      
      let error;
      
      // Delete from the appropriate table based on the reference_document_type
      if (transactionData.reference_document_type === 'PURCHASE') {
        const { error: deleteError } = await supabase
          .from('stock_purchases')
          .delete()
          .eq('purchase_id', transactionId);
        error = deleteError;
      } else if (transactionData.reference_document_type === 'SALE') {
        const { error: deleteError } = await supabase
          .from('stock_sales')
          .delete()
          .eq('sale_id', transactionId);
        error = deleteError;
      } else if (transactionData.reference_document_type === 'ADJUSTMENT') {
        const { error: deleteError } = await supabase
          .from('stock_adjustments')
          .delete()
          .eq('adjustment_id', transactionId);
        error = deleteError;
      }

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete transaction.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Transaction deleted successfully.",
        });
        onRefresh();
      }
    }
  };

  const handleEdit = (transaction: StockTransaction) => {
    // Before passing to the edit function, determine the transaction type
    // and set any additional properties needed for proper editing
    const transactionToEdit = {
      ...transaction,
      // Ensure we have the correct reference to the original table's ID field
      originalTableId: transaction.reference_document_type === 'PURCHASE' ? 'purchase_id' :
                       transaction.reference_document_type === 'SALE' ? 'sale_id' : 'adjustment_id'
    };
    
    onEdit(transactionToEdit);
  };

  const getTransactionTypeBadgeVariant = (type: string) => {
    if (type.includes('STOCK_IN') || type.includes('RETURN')) {
      return 'default';
    }
    if (type.includes('SALE') || type.includes('DISPATCH')) {
      return 'secondary';
    }
    if (type.includes('ADJUST') || type.includes('DAMAGE') || type.includes('LOSS')) {
      return 'destructive';
    }
    return 'outline';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get the transaction date based on the reference document type
  const getTransactionDate = (transaction: StockTransaction) => {
    return transaction.transaction_date;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        Loading transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        No transactions found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Transaction Type</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Cost/Strip</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.transaction_id}>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {transaction.products?.product_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {transaction.products?.product_code}
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {transaction.product_batches?.batch_number}
              </TableCell>
              <TableCell>
                <Badge variant={getTransactionTypeBadgeVariant(transaction.transaction_type)}>
                  {transaction.transaction_type.replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className={transaction.quantity_strips > 0 ? 'text-green-600' : 'text-red-600'}>
                  {transaction.quantity_strips > 0 ? '+' : ''}{transaction.quantity_strips}
                </span>
              </TableCell>
              <TableCell>
                {transaction.location_type_source && (
                  <div className="text-sm">
                    <div>{transaction.location_type_source}</div>
                    {transaction.location_id_source && (
                      <div className="text-gray-500 text-xs">{transaction.location_id_source}</div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {transaction.location_type_destination && (
                  <div className="text-sm">
                    <div>{transaction.location_type_destination}</div>
                    {transaction.location_id_destination && (
                      <div className="text-gray-500 text-xs">{transaction.location_id_destination}</div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono">
                ₹{transaction.cost_per_strip_at_transaction}
              </TableCell>
              <TableCell>
                {transaction.reference_document_type && (
                  <div className="text-sm">
                    <div>{transaction.reference_document_type === 'PURCHASE' ? 'Purchase' : 
                          transaction.reference_document_type === 'SALE' ? 'Sale' : 
                          transaction.reference_document_type === 'ADJUSTMENT' ? 'Adjustment' : 
                          transaction.reference_document_type}</div>
                    {transaction.reference_document_id && (
                      <div className="text-gray-500 text-xs font-mono">{transaction.reference_document_id}</div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div>{formatDate(getTransactionDate(transaction))}</div>
                  <div className="text-gray-500 text-xs">{formatDateTime(transaction.created_at)}</div>
                </div>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {transaction.notes || '-'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(transaction)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDelete(transaction.transaction_id)}
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

export default StockTransactionsTable;
