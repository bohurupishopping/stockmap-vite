import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StockPurchaseTable from '@/components/purchase/PurchaseTable';
import NewPurchase from '@/components/purchase/NewPurchase';
import EditPurchase from '@/components/purchase/EditPurchase';
import ViewPurchase from '@/components/purchase/ViewPurchase';
import { Tables } from '@/integrations/supabase/types';

type StockPurchase = Tables<'stock_purchases'>;

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

const Purchase = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all_suppliers');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [showEditPurchase, setShowEditPurchase] = useState(false);
  const [showViewPurchase, setShowViewPurchase] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');

  // Fetch stock purchases with product and batch details
  const { data: purchases, isLoading, refetch } = useQuery({
    queryKey: ['stock-purchases', searchTerm, supplierFilter],
    queryFn: async () => {
      let query = supabase
        .from('stock_purchases')
        .select(`
          purchase_id,
          purchase_group_id,
          product_id,
          batch_id,
          quantity_strips,
          supplier_id,
          purchase_date,
          reference_document_id,
          cost_per_strip,
          notes,
          created_at,
          created_by,
          products:product_id(product_name, product_code),
          product_batches:batch_id(batch_number, expiry_date)
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`
          reference_document_id.ilike.%${searchTerm}%,
          supplier_id.ilike.%${searchTerm}%
        `);
      }

      if (supplierFilter && supplierFilter !== 'all_suppliers') {
        query = query.eq('supplier_id', supplierFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to include product and batch details
      const transformedData = data?.map(item => ({
        ...item,
        product_name: item.products?.product_name,
        product_code: item.products?.product_code,
        batch_number: item.product_batches?.batch_number,
        expiry_date: item.product_batches?.expiry_date,
      }));

      // Group by purchase_group_id to organize purchases
      const groupedPurchases = transformedData?.reduce((acc: StockPurchaseGroup[], purchase) => {
        const existingGroup = acc.find(g => g.purchase_group_id === purchase.purchase_group_id);
        
        if (existingGroup) {
          existingGroup.items.push(purchase as StockPurchaseItem);
        } else {
          acc.push({
            purchase_group_id: purchase.purchase_group_id,
            reference_document_id: purchase.reference_document_id,
            purchase_date: purchase.purchase_date,
            supplier_id: purchase.supplier_id,
            created_at: purchase.created_at,
            created_by: purchase.created_by,
            items: [purchase as StockPurchaseItem]
          });
        }
        
        return acc;
      }, []);

      return groupedPurchases || [];
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
    setShowNewPurchase(true);
  };

  const handleViewPurchase = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId);
    setShowViewPurchase(true);
  };

  const handleEditPurchase = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId);
    setShowEditPurchase(true);
  };

  const handleCloseModals = () => {
    setShowNewPurchase(false);
    setShowEditPurchase(false);
    setShowViewPurchase(false);
    setSelectedPurchaseId('');
    refetch(); // Refresh data when modals close
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Purchases Management</h1>
          <p className="text-gray-600">Manage goods received notes and stock inflow</p>
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

          <Button 
            onClick={handleNewReceipt} 
            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Purchase
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${purchases?.length || 0} purchase groups found`}
        </p>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-lg border">
        <StockPurchaseTable
          purchases={purchases || []}
          isLoading={isLoading}
          onRefresh={refetch}
          onView={handleViewPurchase}
          onEdit={handleEditPurchase}
        />
      </div>

      {/* Modal Components */}
      {/* New Purchase Modal */}
      <Dialog open={showNewPurchase} onOpenChange={setShowNewPurchase}>
        <DialogContent className="max-w-[75vw] max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Create New Purchase</DialogTitle>
          </DialogHeader>
          <div className="relative h-[95vh] overflow-auto">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-50 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={handleCloseModals}
            >
              <X className="h-4 w-4" />
            </Button>
            <NewPurchase onClose={handleCloseModals} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Modal */}
      <Dialog open={showEditPurchase} onOpenChange={setShowEditPurchase}>
        <DialogContent className="max-w-[75vw] max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Edit Purchase</DialogTitle>
          </DialogHeader>
          <div className="relative h-[95vh] overflow-auto">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-50 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={handleCloseModals}
            >
              <X className="h-4 w-4" />
            </Button>
            <EditPurchase purchaseId={selectedPurchaseId || undefined} onClose={handleCloseModals} />
          </div>
        </DialogContent>
      </Dialog>

      {/* View Purchase Modal */}
      <Dialog open={showViewPurchase} onOpenChange={setShowViewPurchase}>
        <DialogContent className="max-w-[75vw] max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>View Purchase</DialogTitle>
          </DialogHeader>
          <div className="relative h-[95vh] overflow-auto">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-50 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={handleCloseModals}
            >
              <X className="h-4 w-4" />
            </Button>
            <ViewPurchase purchaseId={selectedPurchaseId || undefined} onClose={handleCloseModals} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchase;
