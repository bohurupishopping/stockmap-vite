import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import DispatchLineItem from '@/components/sale/SaleLineItem';

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

interface EditDirectSaleProps {
  saleGroupId: string;
  onClose?: () => void;
}

const EditDirectSale = ({ saleGroupId, onClose }: EditDirectSaleProps) => {
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
  const [showSaleNotes, setShowSaleNotes] = useState(false);
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing sale data
  const { data: existingSale } = useQuery({
    queryKey: ['sale-data', saleGroupId],
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
        .eq('sale_group_id', saleGroupId)
        .eq('transaction_type', 'SALE_DIRECT_GODOWN');
      
      if (error) throw error;
      return data;
    },
    enabled: !!saleGroupId,
  });

  // Load existing data into form
  useEffect(() => {
    if (existingSale && existingSale.length > 0) {
      const firstSale = existingSale[0];
      setFormData({
        customer_name: firstSale.location_id_destination || '',
        invoice_number: firstSale.reference_document_id || '',
        sales_date: firstSale.sale_date || new Date().toISOString().split('T')[0],
        notes: firstSale.notes || '',
      });

      const items: SaleLineItem[] = existingSale.map(sale => ({
        id: sale.sale_id,
        product_id: sale.product_id,
        batch_id: sale.batch_id,
        quantity: Math.abs(sale.quantity_strips), // Convert negative to positive for display
        unit_id: 'strips',
        quantity_strips: Math.abs(sale.quantity_strips),
        cost_per_strip: sale.cost_per_strip,
        notes: sale.notes || '',
      }));
      
      setLineItems(items);
      setIsLoading(false);
    }
  }, [existingSale]);

  // Update sale mutation
  const updateSaleMutation = useMutation({
    mutationFn: async () => {
      // First, delete existing line items
      const { error: deleteError } = await supabase
        .from('stock_sales')
        .delete()
        .eq('sale_group_id', saleGroupId);
      
      if (deleteError) throw deleteError;

      // Then insert updated line items
      const sales = lineItems.map(item => ({
        sale_group_id: saleGroupId,
        product_id: item.product_id,
        batch_id: item.batch_id,
        transaction_type: 'SALE_DIRECT_GODOWN',
        quantity_strips: item.quantity_strips,
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
        description: "Direct sale updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-sales'] });
      queryClient.invalidateQueries({ queryKey: ['recent-dispatches'] });
      if (onClose) {
        onClose();
      } else {
        navigate('/admin/stock/sale');
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update direct sale",
        variant: "destructive",
      });
      console.error('Error updating sale:', error);
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

  const toggleLineItemNotes = (id: string) => {
    const newExpanded = new Set(expandedLineItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLineItems(newExpanded);
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

    updateSaleMutation.mutate();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            if (!updateSaleMutation.isPending && lineItems.length > 0) {
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
              navigate('/admin/stock/sale');
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [updateSaleMutation.isPending, lineItems.length, handleSave, addLineItem, navigate]);

  if (isLoading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span>Loading sale data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 h-screen flex flex-col">
      {/* Modern Header with Breadcrumb */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Edit Direct Sale</h1>
                <p className="text-sm text-gray-500 mt-0.5">Modify existing direct sale record</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Ctrl+S to save
              </div>
              <Button 
                variant="outline" 
                onClick={() => onClose ? onClose() : navigate('/admin/stock/sale')}
                className="px-4 py-2 rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updateSaleMutation.isPending || lineItems.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {updateSaleMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  'Update Sale'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header Section */}
        <Card className="shadow-lg border-0 bg-white rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Sale Details</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Update the basic information for this direct sale</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                Required fields
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name" className="text-sm font-medium text-gray-700">
                  Customer Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  placeholder="e.g., ABC Pharmacy"
                  className="h-9 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_number" className="text-sm font-medium text-gray-700">
                  Invoice Number <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                  placeholder="e.g., INV-2024-001"
                  className="h-9 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales_date" className="text-sm font-medium text-gray-700">
                  Sales Date <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="sales_date"
                  type="date"
                  value={formData.sales_date}
                  onChange={(e) => setFormData({...formData, sales_date: e.target.value})}
                  className="h-9 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Notes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaleNotes(!showSaleNotes)}
                  className="h-9 w-full justify-between rounded-lg"
                >
                  <span className="text-sm">{formData.notes ? 'Notes added' : 'Add notes'}</span>
                  {showSaleNotes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {showSaleNotes && (
              <div className="space-y-2 pt-2">
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Enter any general notes for this sale (optional)"
                  rows={3}
                  className="resize-none rounded-lg"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items Section */}
        <Card className="shadow-lg border-0 bg-white rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Product Line Items</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Modify products in this direct sale
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
          <CardContent className="space-y-3">
            {lineItems.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                <div className="flex flex-col items-center">
                  <Plus className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No products added yet</h3>
                  <p className="text-gray-500 mb-4">Start by adding your first product line item</p>
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
              <div className="space-y-2">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="relative">
                    <div className="absolute -left-4 top-3 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <DispatchLineItem
                        item={item}
                        onUpdate={(updates) => updateLineItem(item.id, updates)}
                        onRemove={() => removeLineItem(item.id)}
                        showGodownStock={true}
                      />
                    </div>
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Total Items:</span> {lineItems.length}
              </div>
              {lineItems.length > 0 && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Total Amount:</span> ₹
                  {lineItems.reduce((sum, item) => sum + (item.quantity_strips * item.cost_per_strip), 0).toFixed(2)}
                </div>
              )}
            </div>
            

          </div>
        </div>
      </div>
    </div>
  );
};

export default EditDirectSale;