import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import DispatchLineItem from '@/components/stock/DispatchLineItem';

interface SaleLineItem {
  id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_id: string;
  quantity_strips: number;
  cost_per_strip: number;
  notes: string;
}

const NewDirectSale = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    customer_name: '',
    invoice_number: '',
    sales_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [lineItems, setLineItems] = useState<SaleLineItem[]>([]);

  // Save sale mutation
  const saveSaleMutation = useMutation({
    mutationFn: async () => {
      const sale_group_id = crypto.randomUUID();
      
      const sales = lineItems.map(item => ({
        sale_group_id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        transaction_type: 'SALE_DIRECT_GODOWN',
        quantity_strips: -Math.abs(item.quantity_strips), // Negative for outflow
        location_type_source: 'GODOWN',
        location_id_source: 'GODOWN_MAIN',
        location_type_destination: 'CUSTOMER',
        location_id_destination: formData.customer_name,
        sale_date: formData.sales_date,
        reference_document_id: formData.invoice_number,
        cost_per_strip: item.cost_per_strip,
        notes: item.notes || formData.notes,
        created_by: profile?.user_id,
      }));

      const { error } = await supabase
        .from('stock_sales')
        .insert(sales);

      if (error) throw error;
      return sales;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Direct sale recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-sales'] });
      navigate('/admin/stock/dispatches');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record direct sale",
        variant: "destructive",
      });
      console.error('Error saving sale:', error);
    },
  });

  const addLineItem = () => {
    const newItem: SaleLineItem = {
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

  const updateLineItem = (id: string, updates: Partial<SaleLineItem>) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleSave = () => {
    if (!formData.customer_name || !formData.invoice_number || lineItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one line item",
        variant: "destructive",
      });
      return;
    }

    saveSaleMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/admin/stock/sale')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dispatches
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Direct Sale</h1>
          <p className="text-gray-600 mt-1">Record a direct sale from godown</p>
        </div>
      </div>

      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle>Sale Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name">Customer/Dealer Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                placeholder="Enter customer or dealer name"
              />
            </div>

            <div>
              <Label htmlFor="invoice_number">Invoice Number *</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                placeholder="Enter invoice number"
              />
            </div>

            <div>
              <Label htmlFor="sales_date">Sales Date *</Label>
              <Input
                id="sales_date"
                type="date"
                value={formData.sales_date}
                onChange={(e) => setFormData({...formData, sales_date: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Overall Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Enter any general notes for this sale"
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
              <DispatchLineItem
                key={item.id}
                item={item}
                onUpdate={(updates) => updateLineItem(item.id, updates)}
                onRemove={() => removeLineItem(item.id)}
                showGodownStock={true}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/stock/sale')}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saveSaleMutation.isPending}
        >
          {saveSaleMutation.isPending ? 'Saving...' : 'Record Sale'}
        </Button>
      </div>
    </div>
  );
};

export default NewDirectSale;
