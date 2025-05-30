import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Truck, ShoppingCart, ArrowLeft, Edit, Eye, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface DispatchTransaction {
  sale_id: string;
  sale_group_id: string;
  product_id: string;
  batch_id: string;
  transaction_type: string;
  quantity_strips: number;
  location_type_destination: string | null;
  location_id_destination: string | null;
  sale_date: string;
  reference_document_id: string | null;
  cost_per_strip: number;
  notes: string | null;
  created_at: string;
  products?: {
    product_name: string;
    product_code: string;
  };
  product_batches?: {
    batch_number: string;
  };
}

const StockDispatches = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch recent dispatch transactions
  const { data: recentDispatches, isLoading, refetch } = useQuery({
    queryKey: ['recent-dispatches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_sales')
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
        .in('transaction_type', ['DISPATCH_TO_MR', 'SALE_DIRECT_GODOWN'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as DispatchTransaction[];
    },
  });

  const handleDelete = async (saleId: string) => {
    if (window.confirm('Are you sure you want to delete this dispatch? This action cannot be undone.')) {
      const { error } = await supabase
        .from('stock_sales')
        .delete()
        .eq('sale_id', saleId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete dispatch transaction.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Dispatch transaction deleted successfully.",
        });
        refetch();
      }
    }
  };

  const handleView = (dispatch: DispatchTransaction) => {
    // For now, we'll show an alert with the dispatch details
    // In a real application, you might navigate to a dedicated view page
    alert(`
      Sale ID: ${dispatch.sale_id}
      Product: ${dispatch.products?.product_name}
      Batch: ${dispatch.product_batches?.batch_number}
      Quantity: ${Math.abs(dispatch.quantity_strips)} strips
      Type: ${dispatch.transaction_type}
      Date: ${new Date(dispatch.sale_date).toLocaleDateString()}
      Reference: ${dispatch.reference_document_id || 'N/A'}
      Notes: ${dispatch.notes || 'No notes'}
    `);
  };

  const handleEdit = (dispatch: DispatchTransaction) => {
    // For now, we'll show an alert
    // In a real application, you might navigate to an edit form
    alert(`Edit functionality for dispatch ${dispatch.sale_id} would be implemented here.`);
  };

  const getDispatchTypeBadge = (type: string) => {
    if (type === 'DISPATCH_TO_MR') {
      return <Badge variant="default">MR Dispatch</Badge>;
    }
    if (type === 'SALE_DIRECT_GODOWN') {
      return <Badge variant="secondary">Direct Sale</Badge>;
    }
    return <Badge variant="outline">{type.replace(/_/g, ' ')}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Dispatches</h1>
          <p className="text-gray-600 mt-1">Manage stock outflow and dispatches</p>
        </div>
      </div>

      {/* Dispatch Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dispatch to MRs */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/stock/dispatches/mr/new')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-blue-600" />
              Dispatch to Medical Representatives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Create dispatch notes for sending stock from godown to Medical Representatives
            </p>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              New MR Dispatch
            </Button>
          </CardContent>
        </Card>

        {/* Direct Sales */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/stock/dispatches/sales/new')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <ShoppingCart className="h-6 w-6 text-green-600" />
              Direct Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Record direct sales from godown to customers, dealers, or distributors
            </p>
            <Button className="w-full" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              New Direct Sale
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Dispatches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Dispatches</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading recent dispatches...
            </div>
          ) : !recentDispatches || recentDispatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent dispatches found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Cost/Strip</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDispatches.map((dispatch) => (
                    <TableRow key={dispatch.sale_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {dispatch.products?.product_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {dispatch.products?.product_code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {dispatch.product_batches?.batch_number}
                      </TableCell>
                      <TableCell>
                        {getDispatchTypeBadge(dispatch.transaction_type)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-600">
                          {Math.abs(dispatch.quantity_strips)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {dispatch.location_type_destination && (
                          <div className="text-sm">
                            <div>{dispatch.location_type_destination}</div>
                            {dispatch.location_id_destination && (
                              <div className="text-gray-500 text-xs">{dispatch.location_id_destination}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {dispatch.reference_document_id && (
                          <div className="text-sm">
                            <div>Sale</div>
                            <div className="text-gray-500 text-xs font-mono">{dispatch.reference_document_id}</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDate(dispatch.sale_date)}</div>
                          <div className="text-gray-500 text-xs">{formatDateTime(dispatch.created_at)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        ₹{dispatch.cost_per_strip}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleView(dispatch)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(dispatch)}
                            title="Edit dispatch"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(dispatch.sale_id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete dispatch"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockDispatches;
