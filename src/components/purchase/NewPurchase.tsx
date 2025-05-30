import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import ReceiptLineItem from '@/components/stock/ReceiptLineItem';
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

const NewPurchase = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    supplier_id: '',
    grn_number: '',
    receipt_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [lineItems, setLineItems] = useState<ReceiptLineItem[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

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

  // Save purchase mutation
  const savePurchaseMutation = useMutation({
    mutationFn: async () => {
      const purchase_group_id = crypto.randomUUID();
      const supplier = suppliers?.find(s => s.id === formData.supplier_id);
      
      const purchases = lineItems.map(item => ({
        purchase_group_id,
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

      const { error } = await supabase
        .from('stock_purchases')
        .insert(purchases);

      if (error) throw error;
      return purchases;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock purchase saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
      navigate('/admin/stock/purchase');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save stock receipt",
        variant: "destructive",
      });
      console.error('Error saving receipt:', error);
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

  const handleSave = () => {
    if (!formData.supplier_id || !formData.grn_number || lineItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one line item",
        variant: "destructive",
      });
      return;
    }

    savePurchaseMutation.mutate();
  };

  const handleBatchCreated = () => {
    setIsBatchModalOpen(false);
    setSelectedProductId('');
    // Refresh product batches query
    queryClient.invalidateQueries({ queryKey: ['product-batches'] });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/admin/stock/purchase')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Receipts
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Stock Receipt</h1>
          <p className="text-gray-600 mt-1">Create a new goods received note (GRN)</p>
        </div>
      </div>

      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Select 
                value={formData.supplier_id} 
                onValueChange={(value) => setFormData({...formData, supplier_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.supplier_name} ({supplier.supplier_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="grn_number">GRN Number *</Label>
              <Input
                id="grn_number"
                value={formData.grn_number}
                onChange={(e) => setFormData({...formData, grn_number: e.target.value})}
                placeholder="Enter GRN number"
              />
            </div>

            <div>
              <Label htmlFor="receipt_date">Receipt Date *</Label>
              <Input
                id="receipt_date"
                type="date"
                value={formData.receipt_date}
                onChange={(e) => setFormData({...formData, receipt_date: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Overall Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Enter any general notes for this receipt"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button onClick={addLineItem} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Product Line
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No line items added yet. Click "Add Product Line" to get started.
            </div>
          ) : (
            lineItems.map((item) => (
              <ReceiptLineItem
                key={item.id}
                item={item}
                onUpdate={(updates) => updateLineItem(item.id, updates)}
                onRemove={() => removeLineItem(item.id)}
                onCreateBatch={(productId) => {
                  setSelectedProductId(productId);
                  setIsBatchModalOpen(true);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/stock/purchase')}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={savePurchaseMutation.isPending}
        >
          {savePurchaseMutation.isPending ? 'Saving...' : 'Save Purchase'}
        </Button>
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

export default NewPurchase;
