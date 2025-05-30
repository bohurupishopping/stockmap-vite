
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StockReceiptsTable from '@/components/stock-purchase/StockReceiptsTable';

const StockReceipts = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all_suppliers');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch stock receipts (grouped transactions)
  const { data: receipts, isLoading, refetch } = useQuery({
    queryKey: ['stock-receipts', searchTerm, supplierFilter],
    queryFn: async () => {
      let query = supabase
        .from('stock_transactions')
        .select(`
          transaction_group_id,
          reference_document_id,
          transaction_date,
          location_id_source,
          created_at,
          created_by
        `)
        .eq('transaction_type', 'STOCK_IN_GODOWN')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`
          reference_document_id.ilike.%${searchTerm}%,
          location_id_source.ilike.%${searchTerm}%
        `);
      }

      if (supplierFilter && supplierFilter !== 'all_suppliers') {
        query = query.eq('location_id_source', supplierFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by transaction_group_id to get unique receipts
      const groupedReceipts = data?.reduce((acc: any[], transaction) => {
        const existing = acc.find(r => r.transaction_group_id === transaction.transaction_group_id);
        if (!existing) {
          acc.push(transaction);
        }
        return acc;
      }, []);

      return groupedReceipts || [];
    },
  });

  // Fetch suppliers for filter
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('supplier_name');
      if (error) throw error;
      return data;
    },
  });

  const handleNewReceipt = () => {
    navigate('/admin/stock/receipts/new');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Stock Receipts Management
        </h1>
        <p className="text-gray-600 mt-1">
          Manage goods received notes and stock inflow
        </p>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by GRN number or supplier..."
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
            <Button onClick={handleNewReceipt} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Receipt
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier</label>
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All suppliers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_suppliers">All suppliers</SelectItem>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.supplier_name}>
                          {supplier.supplier_name}
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
          {isLoading ? 'Loading...' : `${receipts?.length || 0} receipts found`}
        </p>
      </div>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <StockReceiptsTable
            receipts={receipts || []}
            isLoading={isLoading}
            onRefresh={refetch}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default StockReceipts;
