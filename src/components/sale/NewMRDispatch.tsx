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
import { Plus, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import DispatchLineItem from '@/components/sale/SaleLineItem';

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

interface NewMRDispatchProps {
  onClose?: () => void;
}

const NewMRDispatch = ({ onClose }: NewMRDispatchProps = {}) => {
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
  const [showDispatchNotes, setShowDispatchNotes] = useState(false);
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(new Set());

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
        quantity_strips: item.quantity_strips,
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
      if (onClose) {
        onClose();
      } else {
        navigate('/admin/stock/sale');
      }
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

  const toggleLineItemNotes = (id: string) => {
    const newExpanded = new Set(expandedLineItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLineItems(newExpanded);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        addLineItem();
      } else if (e.key === 'Escape') {
        if (onClose) {
          onClose();
        } else {
          navigate('/admin/stock/sale');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, navigate]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header with Breadcrumb */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">New MR Dispatch</h1>
                <p className="text-sm text-gray-500 mt-0.5">Create a new dispatch to Medical Representative</p>
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
        {/* Header Section */}
        <Card className="shadow-lg border-0 bg-white rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Dispatch Details</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Enter the basic information for this MR dispatch</p>
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
                <Label htmlFor="mr_user" className="text-sm font-medium text-gray-700">
                  Medical Representative <span className="text-red-400">*</span>
                </Label>
                <Select 
                  value={formData.mr_user_id} 
                  onValueChange={(value) => setFormData({...formData, mr_user_id: value})}
                >
                  <SelectTrigger className="h-9 rounded-lg">
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

              <div className="space-y-2">
                <Label htmlFor="dispatch_reference" className="text-sm font-medium text-gray-700">
                  Dispatch Reference <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="dispatch_reference"
                  value={formData.dispatch_reference}
                  onChange={(e) => setFormData({...formData, dispatch_reference: e.target.value})}
                  placeholder="e.g., DISP-2024-001"
                  className="h-9 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dispatch_date" className="text-sm font-medium text-gray-700">
                  Dispatch Date <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="dispatch_date"
                  type="date"
                  value={formData.dispatch_date}
                  onChange={(e) => setFormData({...formData, dispatch_date: e.target.value})}
                  className="h-9 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Notes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDispatchNotes(!showDispatchNotes)}
                  className="h-9 w-full justify-between rounded-lg"
                >
                  <span className="text-sm">{formData.notes ? 'Notes added' : 'Add notes'}</span>
                  {showDispatchNotes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {showDispatchNotes && (
              <div className="space-y-2 pt-2">
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Enter any general notes for this dispatch (optional)"
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
                  Add products to this MR dispatch
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Total Items:</span> {lineItems.length}
              </div>
              {lineItems.length > 0 && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Total Cost:</span> ₹
                  {lineItems.reduce((sum, item) => sum + (item.quantity_strips * item.cost_per_strip), 0).toFixed(2)}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => onClose ? onClose() : navigate('/admin/stock/sale')}
                className="px-6 rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saveDispatchMutation.isPending || lineItems.length === 0}
                className="px-6 bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {saveDispatchMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Confirm Dispatch'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewMRDispatch;
