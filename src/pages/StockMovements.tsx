
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter } from 'lucide-react';
import StockTransactionsTable from '@/components/stock/StockTransactionsTable';
import StockTransactionModal from '@/components/stock/StockTransactionModal';

export interface StockTransaction {
  transaction_id: string;
  transaction_group_id: string;
  product_id: string;
  batch_id: string;
  transaction_type: string;
  quantity_strips: number;
  location_type_source: string | null;
  location_id_source: string | null;
  location_type_destination: string | null;
  location_id_destination: string | null;
  transaction_date: string;
  reference_document_type: string | null;
  reference_document_id: string | null;
  cost_per_strip_at_transaction: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  products?: {
    product_name: string;
    product_code: string;
  };
  product_batches?: {
    batch_number: string;
  };
}

const StockMovements = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<StockTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all_types');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch stock transactions
  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['stock-transactions', searchTerm, transactionTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from('stock_transactions')
        .select(`
          *,
          products:product_id (
            product_name,
            product_code
          ),
          product_batches:batch_id (
            batch_number
          )
        `)
        .order('created_at', { ascending: false });

      // Apply search filter
      if (searchTerm) {
        query = query.or(`
          reference_document_id.ilike.%${searchTerm}%,
          products.product_name.ilike.%${searchTerm}%,
          products.product_code.ilike.%${searchTerm}%,
          product_batches.batch_number.ilike.%${searchTerm}%
        `);
      }

      // Apply transaction type filter
      if (transactionTypeFilter && transactionTypeFilter !== 'all_types') {
        query = query.eq('transaction_type', transactionTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StockTransaction[];
    },
  });

  const handleAddNew = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEdit = (transaction: StockTransaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const handleSuccess = () => {
    refetch();
    handleCloseModal();
  };

  const transactionTypes = [
    'STOCK_IN_GODOWN',
    'DISPATCH_TO_MR',
    'SALE_DIRECT_GODOWN',
    'SALE_BY_MR',
    'RETURN_TO_GODOWN',
    'RETURN_TO_MR',
    'ADJUST_DAMAGE_GODOWN',
    'ADJUST_LOSS_GODOWN',
    'ADJUST_DAMAGE_MR',
    'ADJUST_LOSS_MR',
    'ADJUST_EXPIRED_GODOWN',
    'ADJUST_EXPIRED_MR',
    'REPLACEMENT_FROM_GODOWN',
    'REPLACEMENT_FROM_MR',
    'OPENING_STOCK_GODOWN',
    'OPENING_STOCK_MR'
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Stock Movement Management
        </h1>
        <p className="text-gray-600 mt-1">
          Track all inventory movements and transactions
        </p>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by reference ID, product name, product code, or batch number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button onClick={handleAddNew} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Transaction Type</label>
                  <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All transaction types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_types">All transaction types</SelectItem>
                      {transactionTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${transactions?.length || 0} transactions found`}
        </p>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <StockTransactionsTable
            transactions={transactions || []}
            isLoading={isLoading}
            onEdit={handleEdit}
            onRefresh={refetch}
          />
        </CardContent>
      </Card>

      {/* Modal */}
      <StockTransactionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        editingTransaction={editingTransaction}
      />
    </div>
  );
};

export default StockMovements;
