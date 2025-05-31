import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowLeft, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import ReceiptLineItem from '@/components/sale/SaleLineItem';
import BatchModal from '@/components/batches/BatchModal';

interface ReceiptLineItem {
  id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_id: string;
  quantity_strips: number;
  cost_per_strip: number;
  notes: string;
}

interface EditPurchaseProps {
  purchaseId?: string;
  onClose?: () => void;
}

const EditPurchase = ({ purchaseId, onClose }: EditPurchaseProps = {}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { id: paramId } = useParams<{ id: string }>();
  const id = purchaseId || paramId; // Use prop if available, otherwise use URL param

  const [formData, setFormData] = useState({
    supplier_id: '',
    grn_number: '',
    receipt_date: '',
    notes: '',
  });

  const [lineItems, setLineItems] = useState<ReceiptLineItem[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [showReceiptNotes, setShowReceiptNotes] = useState(false);
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(new Set());

  // Fetch receipt details
  const { data: receiptDetails, isLoading } = useQuery({
    queryKey: ['stock-receipt-details', id],
    queryFn: async () => {
      if (!id) throw new Error('Receipt ID is required');

      const { data, error } = await supabase
        .from('stock_purchases')
        .select('*')
        .eq('purchase_group_id', id)
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch existing line items for this purchase
  const { data: existingLineItems } = useQuery({
    queryKey: ['purchase-line-items', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('stock_purchases')
        .select('*')
        .eq('purchase_group_id', id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
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

  // Fetch product data for BatchModal
  const { data: selectedProduct } = useQuery({
    queryKey: ['product-for-batch', selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return null;
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, product_code, base_cost_per_strip')
        .eq('id', selectedProductId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProductId,
  });

  // Update form data when receipt details are loaded
  useEffect(() => {
    if (receiptDetails) {
      // Find supplier by name
      const supplier = suppliers?.find(s => s.supplier_name === receiptDetails.supplier_id);
      
      setFormData({
        supplier_id: supplier?.id || '',
        grn_number: receiptDetails.reference_document_id || '',
        receipt_date: receiptDetails.purchase_date ? 
          new Date(receiptDetails.purchase_date).toISOString().split('T')[0] : '',
        notes: receiptDetails.notes || '',
      });
    }
  }, [receiptDetails, suppliers]);

  // Update line items when existing line items are loaded
  useEffect(() => {
    if (existingLineItems && existingLineItems.length > 0) {
      const formattedLineItems: ReceiptLineItem[] = existingLineItems.map(item => ({
        id: item.purchase_id || crypto.randomUUID(),
        product_id: item.product_id || '',
        batch_id: item.batch_id || '',
        quantity: 0, // This will be calculated from quantity_strips and unit conversion
        unit_id: '', // This needs to be fetched based on the product
        quantity_strips: item.quantity_strips || 0,
        cost_per_strip: item.cost_per_strip || 0,
        notes: item.notes || '',
      }));
      setLineItems(formattedLineItems);
    }
  }, [existingLineItems]);

  // Update receipt mutation
  const updateReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Receipt ID is required');
      
      const supplier = suppliers?.find(s => s.id === formData.supplier_id);
      
      // First, delete existing line items
      const { error: deleteError } = await supabase
        .from('stock_purchases')
        .delete()
        .eq('purchase_group_id', id);

      if (deleteError) throw deleteError;

      // Then insert updated line items
      const purchases = lineItems.map(item => ({
        purchase_group_id: id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity_strips: item.quantity_strips,
        supplier_id: supplier?.supplier_name || formData.supplier_id,
        purchase_date: formData.receipt_date,
        reference_document_id: formData.grn_number,
        cost_per_strip: item.cost_per_strip,
        notes: item.notes || formData.notes,
        created_by: profile?.user_id,
      }));

      const { error: insertError } = await supabase
        .from('stock_purchases')
        .insert(purchases);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock receipt updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['stock-receipt-details', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-line-items', id] });
      if (onClose) {
        onClose();
      } else {
        navigate('/admin/stock/purchase');
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update stock receipt",
        variant: "destructive",
      });
      console.error('Error updating receipt:', error);
    },
  });

  const addLineItem = () => {
    const newItem: ReceiptLineItem = {
      id: crypto.randomUUID(),
      product_id: '',
      batch_id: '',
      quantity: 0,
      unit_id: '',
      quantity_strips: 0,
      cost_per_strip: 0,
      notes: '',
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, updates: Partial<ReceiptLineItem>) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const toggleLineItemNotes = (id: string) => {
    setExpandedLineItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    if (!formData.supplier_id || !formData.grn_number || lineItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one line item",
        variant: "destructive",
      });
      return;
    }

    updateReceiptMutation.mutate();
  };

  const handleBatchCreated = () => {
    setIsBatchModalOpen(false);
    setSelectedProductId('');
    // Refresh product batches query
    queryClient.invalidateQueries({ queryKey: ['product-batches'] });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            if (!updateReceiptMutation.isPending && lineItems.length > 0) {
              handleSave();
            }
            break;
          case 'n':
            event.preventDefault();
            addLineItem();
            break;
          case 'Escape':
            event.preventDefault();
            if (onClose) {
              onClose();
            } else {
              navigate('/admin/stock/purchase');
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [updateReceiptMutation.isPending, lineItems.length, handleSave, addLineItem, navigate, onClose]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading receipt details...</div>
        </div>
      </div>
    );
  }

  if (!receiptDetails) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/admin/stock/purchase')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Purchase
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Receipt Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header with Breadcrumb */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            
             
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Edit Purchase Receipt</h1>
                <p className="text-sm text-gray-500 mt-0.5">Update receipt information and line items</p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Ctrl+S to save
              </div>
            
             
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[100%] mx-auto space-y-6">

        {/* Edit Form */}
        <Card className="shadow-lg border-0 bg-white rounded-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Purchase Details</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Update the basic information for this purchase receipt</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                Required fields
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier" className="text-sm font-medium text-gray-700">
                  Supplier <span className="text-red-400">*</span>
                </Label>
                <Select 
                  value={formData.supplier_id} 
                  onValueChange={(value) => setFormData({...formData, supplier_id: value})}
                >
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Choose supplier..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{supplier.supplier_name}</span>
                          <span className="text-xs text-gray-500">{supplier.supplier_code}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grn_number" className="text-sm font-medium text-gray-700">
                  GRN Number <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="grn_number"
                  value={formData.grn_number}
                  onChange={(e) => setFormData({...formData, grn_number: e.target.value})}
                  placeholder="e.g., GRN-2024-001"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt_date" className="text-sm font-medium text-gray-700">
                  Purchase Date <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="receipt_date"
                  type="date"
                  value={formData.receipt_date}
                  onChange={(e) => setFormData({...formData, receipt_date: e.target.value})}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            {/* Notes Toggle Section */}
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowReceiptNotes(!showReceiptNotes)}
                className="text-gray-600 hover:text-gray-900 p-0 h-auto font-normal"
              >
                <div className="flex items-center gap-2">
                  {showReceiptNotes ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span>
                    {formData.notes ? 'Receipt notes added' : 'Add receipt notes'}
                  </span>
                </div>
              </Button>
              
              {showReceiptNotes && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium text-gray-700">Overall Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Enter any general notes for this receipt (optional)"
                    rows={3}
                    className="resize-none rounded-lg"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Line Items Section */}
        <Card className="shadow-lg border-0 bg-white rounded-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Product Line Items</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Manage products in this purchase receipt
                  {lineItems.length > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                  Tab to navigate
                </div>
                <Button 
                  onClick={addLineItem} 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Product
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                <div className="flex flex-col items-center">
                  <Plus className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-500 mb-4">Add products to this purchase receipt</p>
                  <Button 
                    onClick={addLineItem}
                    variant="outline"
                    className="border-green-200 text-green-700 hover:bg-green-50 rounded-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Product
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="relative bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="absolute -left-2 top-4 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <ReceiptLineItem
                      item={item}
                      onUpdate={(updates) => updateLineItem(item.id, updates)}
                      onRemove={() => removeLineItem(item.id)}
                      onCreateBatch={(productId) => {
                        setSelectedProductId(productId);
                        setIsBatchModalOpen(true);
                      }}
                      isCompact={true}
                      showNotes={expandedLineItems.has(item.id)}
                      onToggleNotes={() => toggleLineItemNotes(item.id)}
                    />
                  </div>
                ))}
                
                {/* Quick Add Button */}
                <div className="pt-2">
                  <Button 
                    onClick={addLineItem}
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-gray-300 text-gray-600 hover:border-green-300 hover:text-green-600 rounded-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Product
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary and Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Total Items:</span> {lineItems.length}
              </div>
              {lineItems.length > 0 && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Total Cost:</span> $
                  {lineItems.reduce((sum, item) => sum + (item.quantity_strips * item.cost_per_strip), 0).toFixed(2)}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => onClose ? onClose() : navigate('/admin/stock/purchase')}
                className="px-6 rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updateReceiptMutation.isPending || lineItems.length === 0}
                className="px-6 bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {updateReceiptMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Modal */}
      {selectedProduct && (
        <BatchModal
          isOpen={isBatchModalOpen}
          onClose={() => {
            setIsBatchModalOpen(false);
            setSelectedProductId('');
          }}
          onSuccess={handleBatchCreated}
          editingBatch={null}
          productId={selectedProductId}
          product={selectedProduct}
        />
      )}
    </div>
  );
};

export default EditPurchase;
