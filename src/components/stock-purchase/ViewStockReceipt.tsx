
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';

const ViewStockReceipt = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Fetch receipt details
  const { data: receiptDetails, isLoading } = useQuery({
    queryKey: ['stock-receipt-details', id],
    queryFn: async () => {
      if (!id) throw new Error('Receipt ID is required');

      const { data, error } = await supabase
        .from('stock_transactions')
        .select(`
          *,
          products:product_id (
            product_name,
            product_code,
            generic_name
          ),
          product_batches:batch_id (
            batch_number,
            manufacturing_date,
            expiry_date
          )
        `)
        .eq('transaction_group_id', id)
        .eq('transaction_type', 'STOCK_IN_GODOWN');

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading receipt details...</div>
        </div>
      </div>
    );
  }

  if (!receiptDetails || receiptDetails.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/admin/stock/receipts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Receipts
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Receipt Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  const firstTransaction = receiptDetails[0];
  const totalQuantity = receiptDetails.reduce((sum, item) => sum + item.quantity_strips, 0);
  const totalValue = receiptDetails.reduce((sum, item) => sum + (item.quantity_strips * item.cost_per_strip_at_transaction), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/admin/stock/receipts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Receipts
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">View Stock Receipt</h1>
            <p className="text-gray-600 mt-1">GRN: {firstTransaction.reference_document_id}</p>
          </div>
        </div>
        <Button onClick={() => navigate(`/admin/stock/receipts/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Receipt
        </Button>
      </div>

      {/* Receipt Header Details */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">GRN Number</label>
              <p className="mt-1 text-gray-900">{firstTransaction.reference_document_id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Supplier</label>
              <p className="mt-1 text-gray-900">{firstTransaction.location_id_source}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Receipt Date</label>
              <p className="mt-1 text-gray-900">
                {format(new Date(firstTransaction.transaction_date), 'dd/MM/yyyy')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Created Date</label>
              <p className="mt-1 text-gray-900">
                {format(new Date(firstTransaction.created_at), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Items</label>
              <p className="mt-1 text-gray-900">{receiptDetails.length}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Strips</label>
              <p className="mt-1 text-gray-900">{totalQuantity.toLocaleString()}</p>
            </div>
          </div>
          {firstTransaction.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <p className="mt-1 text-gray-900">{firstTransaction.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{receiptDetails.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{totalQuantity.toLocaleString()}</p>
            <p className="text-sm text-gray-500">strips</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">₹{totalValue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">Batch</th>
                  <th className="text-left py-2">Quantity</th>
                  <th className="text-left py-2">Cost/Strip</th>
                  <th className="text-left py-2">Total Value</th>
                  <th className="text-left py-2">Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {receiptDetails.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{item.products?.product_name}</p>
                        <p className="text-sm text-gray-500">{item.products?.product_code}</p>
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="font-medium">{item.product_batches?.batch_number}</p>
                    </td>
                    <td className="py-3">
                      <p>{item.quantity_strips.toLocaleString()} strips</p>
                    </td>
                    <td className="py-3">
                      <p>₹{item.cost_per_strip_at_transaction}</p>
                    </td>
                    <td className="py-3">
                      <p>₹{(item.quantity_strips * item.cost_per_strip_at_transaction).toLocaleString()}</p>
                    </td>
                    <td className="py-3">
                      <p>{item.product_batches?.expiry_date 
                        ? format(new Date(item.product_batches.expiry_date), 'dd/MM/yyyy')
                        : '-'
                      }</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ViewStockReceipt;
