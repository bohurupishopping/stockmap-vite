import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Truck, ShoppingCart, ArrowLeft, Edit, Eye, Trash2, Search, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import NewDirectSale from '@/components/sale/NewDirectSale';
import NewMRDispatch from '@/components/sale/NewMRDispatch';
import EditDirectSale from '@/components/sale/EditDirectSale';
import EditMRDispatch from '@/components/sale/EditMRDispatch';

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

const Sale = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all_suppliers');
  
  // Modal states
  const [showNewDirectSale, setShowNewDirectSale] = useState(false);
  const [showNewMRDispatch, setShowNewMRDispatch] = useState(false);
  const [showEditDirectSale, setShowEditDirectSale] = useState(false);
  const [showEditMRDispatch, setShowEditMRDispatch] = useState(false);
  const [selectedSaleGroupId, setSelectedSaleGroupId] = useState<string>('');

  // Handle modal close and refresh
  const handleCloseModals = () => {
    setShowNewDirectSale(false);
    setShowNewMRDispatch(false);
    setShowEditDirectSale(false);
    setShowEditMRDispatch(false);
    setSelectedSaleGroupId('');
    refetch(); // Refresh data when modals close
  };

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

  // Fetch recent dispatch transactions
  const { data: recentDispatches, isLoading, refetch } = useQuery({
    queryKey: ['recent-dispatches', searchTerm, supplierFilter],
    queryFn: async () => {
      let query = supabase
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

      if (searchTerm) {
        query = query.or(`
          reference_document_id.ilike.%${searchTerm}%,
          supplier_id.ilike.%${searchTerm}%
        `);
      }

 

      const { data, error } = await query;
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
    setSelectedSaleGroupId(dispatch.sale_group_id);
    
    if (dispatch.transaction_type === 'SALE_DIRECT_GODOWN') {
      setShowEditDirectSale(true);
    } else if (dispatch.transaction_type === 'SALE_MR_DISPATCH' || dispatch.transaction_type === 'DISPATCH_TO_MR') {
      setShowEditMRDispatch(true);
    } else {
      toast({
        title: "Error",
        description: "Cannot edit this transaction type",
        variant: "destructive",
      });
    }
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
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Sales</h1>
          <p className="text-gray-600">Manage stock outflow and sales</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-40 rounded-full border-0 focus-visible:ring-1"
              />
            </div>
            
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="h-8 px-2 rounded-full text-sm bg-white border-0 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all_suppliers">All Suppliers</option>
              {suppliers?.map((supplier) => (
                <option key={supplier.id} value={supplier.supplier_name}>
                  {supplier.supplier_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Button 
              onClick={() => setShowNewDirectSale(true)} 
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Direct Sales
            </Button>
            <Button 
              onClick={() => setShowNewMRDispatch(true)}
              className="h-8 px-3 bg-red-600 hover:bg-blue-700 rounded-full text-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              MR Sales
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Dispatches */}
      <div className="bg-white rounded-lg border">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Loading sales...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : !recentDispatches || recentDispatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No sales found. Create your first sale to get started.
                </TableCell>
              </TableRow>
            ) : (
              recentDispatches.map((dispatch) => (
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
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-3 rounded-full"
                        onClick={() => handleView(dispatch)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-3 rounded-full"
                        onClick={() => handleEdit(dispatch)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-3 rounded-full text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(dispatch.sale_id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Components */}
      {/* New Direct Sale Modal */}
      <Dialog open={showNewDirectSale} onOpenChange={setShowNewDirectSale}>
        <DialogContent className="max-w-[75vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>New Direct Sale</DialogTitle>
          </DialogHeader>
          <button
            onClick={() => setShowNewDirectSale(false)}
            className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <NewDirectSale onClose={handleCloseModals} />
        </DialogContent>
      </Dialog>

      {/* New MR Dispatch Modal */}
      <Dialog open={showNewMRDispatch} onOpenChange={setShowNewMRDispatch}>
        <DialogContent className="max-w-[75vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>New MR Dispatch</DialogTitle>
          </DialogHeader>
          <button
            onClick={() => setShowNewMRDispatch(false)}
            className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <NewMRDispatch onClose={handleCloseModals} />
        </DialogContent>
      </Dialog>

      {/* Edit Direct Sale Modal */}
      <Dialog open={showEditDirectSale} onOpenChange={setShowEditDirectSale}>
        <DialogContent className="max-w-[75vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Edit Direct Sale</DialogTitle>
          </DialogHeader>
          <button
            onClick={() => setShowEditDirectSale(false)}
            className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          {selectedSaleGroupId && (
            <EditDirectSale 
              saleGroupId={selectedSaleGroupId} 
              onClose={handleCloseModals} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit MR Dispatch Modal */}
      <Dialog open={showEditMRDispatch} onOpenChange={setShowEditMRDispatch}>
        <DialogContent className="max-w-[75vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Edit MR Dispatch</DialogTitle>
          </DialogHeader>
          <button
            onClick={() => setShowEditMRDispatch(false)}
            className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          {selectedSaleGroupId && (
            <EditMRDispatch 
              saleGroupId={selectedSaleGroupId} 
              onClose={handleCloseModals} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sale;
