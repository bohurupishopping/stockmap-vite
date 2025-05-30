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
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import DispatchLineItem from '@/components/purchase/PurchaseLineItem';

interface DispatchLineItem {
  id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_id: string;
  quantity_strips: number;
  cost_per_strip: number;
  notes: string;
}

const NewMRDispatch = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    mr_user_id: '',
    dispatch_reference: '',
    dispatch_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [lineItems, setLineItems] = useState<DispatchLineItem[]>([]);

  // Fetch Medical Representatives (users with role 'user' for now)
  const { data: medicalReps } = useQuery({
    queryKey: ['medical-reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Save dispatch mutation
  const saveDispatchMutation = useMutation({
    mutationFn: async () => {
      const sale_group_id = crypto.randomUUID();
      
      const sales = lineItems.map(item => ({
        sale_group_id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        transaction_type: 'DISPATCH_TO_MR',
        quantity_strips: -Math.abs(item.quantity_strips), // Negative for outflow
        location_type_source: 'GODOWN',
        location_id_source: 'GODOWN_MAIN',
        location_type_destination: 'MR',
        location_id_destination: formData.mr_user_id,
        sale_date: formData.dispatch_date,
        reference_document_id: formData.dispatch_reference,
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
        description: "MR dispatch saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-sales'] });
      navigate('/admin/stock/dispatches');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save MR dispatch",
        variant: "destructive",
      });
      console.error('Error saving dispatch:', error);
    },
  });

  const addLineItem = () => {
    const newItem: DispatchLineItem = {
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

  const updateLineItem = (id: string, updates: Partial<DispatchLineItem>) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleSave = () => {
    if (!formData.mr_user_id || !formData.dispatch_reference || lineItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one line item",
        variant: "destructive",
      });
      return;
    }

    saveDispatchMutation.mutate();
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
          <h1 className="text-3xl font-bold text-gray-900">New MR Dispatch</h1>
          <p className="text-gray-600 mt-1">Create a new dispatch to Medical Representative</p>
        </div>
      </div>

      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle>Dispatch Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mr_user">Medical Representative *</Label>
              <Select 
                value={formData.mr_user_id} 
                onValueChange={(value) => setFormData({...formData, mr_user_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Medical Representative" />
                </SelectTrigger>
                <SelectContent>
                  {medicalReps?.map((mr) => (
                    <SelectItem key={mr.id} value={mr.user_id}>
                      {mr.name} ({mr.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dispatch_reference">Dispatch Note / Reference ID *</Label>
              <Input
                id="dispatch_reference"
                value={formData.dispatch_reference}
                onChange={(e) => setFormData({...formData, dispatch_reference: e.target.value})}
                placeholder="Enter dispatch reference"
              />
            </div>

            <div>
              <Label htmlFor="dispatch_date">Dispatch Date *</Label>
              <Input
                id="dispatch_date"
                type="date"
                value={formData.dispatch_date}
                onChange={(e) => setFormData({...formData, dispatch_date: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Overall Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Enter any general notes for this dispatch"
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
          onClick={() => navigate('/admin/stock/dispatches')}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saveDispatchMutation.isPending}
        >
          {saveDispatchMutation.isPending ? 'Saving...' : 'Confirm Dispatch'}
        </Button>
      </div>
    </div>
  );
};

export default NewMRDispatch;
