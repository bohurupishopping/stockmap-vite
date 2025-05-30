
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
      const { error } = await supabase
        .from('stock_transactions')
        .delete()
        .eq('transaction_id', transactionId);

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
                    <div>{transaction.reference_document_type}</div>
                    {transaction.reference_document_id && (
                      <div className="text-gray-500 text-xs font-mono">{transaction.reference_document_id}</div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div>{formatDate(transaction.transaction_date)}</div>
                  <div className="text-gray-500 text-xs">{formatDateTime(transaction.transaction_date)}</div>
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
                    onClick={() => onEdit(transaction)}
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
