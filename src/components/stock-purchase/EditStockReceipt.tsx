
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const EditStockReceipt = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const [formData, setFormData] = useState({
    supplier_id: '',
    grn_number: '',
    receipt_date: '',
    notes: '',
  });

  // Fetch receipt details
  const { data: receiptDetails, isLoading } = useQuery({
    queryKey: ['stock-receipt-details', id],
    queryFn: async () => {
      if (!id) throw new Error('Receipt ID is required');

      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_group_id', id)
        .eq('transaction_type', 'STOCK_IN_GODOWN')
        .limit(1)
        .single();

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

  // Update form data when receipt details are loaded
  useEffect(() => {
    if (receiptDetails) {
      // Find supplier by name
      const supplier = suppliers?.find(s => s.supplier_name === receiptDetails.location_id_source);
      
      setFormData({
        supplier_id: supplier?.id || '',
        grn_number: receiptDetails.reference_document_id || '',
        receipt_date: receiptDetails.transaction_date ? 
          new Date(receiptDetails.transaction_date).toISOString().split('T')[0] : '',
        notes: receiptDetails.notes || '',
      });
    }
  }, [receiptDetails, suppliers]);

  // Update receipt mutation
  const updateReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Receipt ID is required');
      
      const supplier = suppliers?.find(s => s.id === formData.supplier_id);
      
      const { error } = await supabase
        .from('stock_transactions')
        .update({
          location_id_source: supplier?.supplier_name || formData.supplier_id,
          reference_document_id: formData.grn_number,
          transaction_date: formData.receipt_date,
          notes: formData.notes,
        })
        .eq('transaction_group_id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock receipt updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-receipt-details', id] });
      navigate('/admin/stock/receipts');
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

  const handleSave = () => {
    if (!formData.supplier_id || !formData.grn_number) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    updateReceiptMutation.mutate();
  };

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/admin/stock/receipts')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Receipts
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Stock Receipt</h1>
          <p className="text-gray-600 mt-1">Update receipt information</p>
        </div>
      </div>

      {/* Edit Form */}
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Enter any notes for this receipt"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/stock/receipts')}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={updateReceiptMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {updateReceiptMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default EditStockReceipt;
