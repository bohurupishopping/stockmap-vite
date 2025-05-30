import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface ReplacementItem {
  id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_id: string;
  quantity_strips: number;
  cost_per_strip: number;
  notes: string;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  generic_name: string;
}

interface Batch {
  id: string;
  batch_number: string;
  expiry_date: string;
  batch_cost_per_strip: number;
}

interface PackagingUnit {
  id: string;
  unit_name: string;
  conversion_factor_to_strips: number;
}

const NewReplacement = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [replacementDate, setReplacementDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [returnItems, setReturnItems] = useState<ReplacementItem[]>([]);
  const [dispatchItems, setDispatchItems] = useState<ReplacementItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [currentSection, setCurrentSection] = useState<'return' | 'dispatch'>('return');

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: batches } = useQuery({
    queryKey: ['batches', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const { data, error } = await supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', selectedProduct)
        .eq('status', 'Active');
      if (error) throw error;
      return data as Batch[];
    },
    enabled: !!selectedProduct,
  });

  const { data: packagingUnits } = useQuery({
    queryKey: ['packaging-units', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const { data, error } = await supabase
        .from('product_packaging_units')
        .select('*')
        .eq('product_id', selectedProduct)
        .order('order_in_hierarchy');
      if (error) throw error;
      return data as PackagingUnit[];
    },
    enabled: !!selectedProduct,
  });

  const addLineItem = () => {
    if (!selectedProduct || !selectedBatch || !selectedUnit || !quantity) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    const product = products?.find(p => p.id === selectedProduct);
    const batch = batches?.find(b => b.id === selectedBatch);
    const unit = packagingUnits?.find(u => u.id === selectedUnit);

    if (!product || !batch || !unit) return;

    const quantityStrips = parseInt(quantity) * unit.conversion_factor_to_strips;
    const costPerStrip = batch.batch_cost_per_strip || 0;

    const newItem: ReplacementItem = {
      id: Math.random().toString(36).substr(2, 9),
      product_id: selectedProduct,
      batch_id: selectedBatch,
      quantity: parseInt(quantity),
      unit_id: selectedUnit,
      quantity_strips: quantityStrips,
      cost_per_strip: costPerStrip,
      notes: itemNotes,
    };

    if (currentSection === 'return') {
      setReturnItems([...returnItems, newItem]);
    } else {
      setDispatchItems([...dispatchItems, newItem]);
    }
    
    // Reset form
    setSelectedProduct('');
    setSelectedBatch('');
    setSelectedUnit('');
    setQuantity('');
    setItemNotes('');
  };

  const removeLineItem = (id: string, section: 'return' | 'dispatch') => {
    if (section === 'return') {
      setReturnItems(returnItems.filter(item => item.id !== id));
    } else {
      setDispatchItems(dispatchItems.filter(item => item.id !== id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (returnItems.length === 0 || dispatchItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add items to both return and dispatch sections",
        variant: "destructive",
      });
      return;
    }

    try {
      const adjustment_group_id = crypto.randomUUID();

      // Create return transactions (from customer to godown)
      const returnAdjustments = returnItems.map(item => ({
        adjustment_group_id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        adjustment_type: 'RETURN_TO_GODOWN',
        quantity_strips: item.quantity_strips,
        location_type_source: 'CUSTOMER',
        location_id_source: 'CUSTOMER',
        location_type_destination: 'GODOWN',
        location_id_destination: 'GODOWN',
        adjustment_date: replacementDate,
        cost_per_strip: item.cost_per_strip,
        notes: item.notes || notes,
        created_by: profile?.user_id,
      }));

      // Create dispatch transactions (from godown to customer)
      const dispatchAdjustments = dispatchItems.map(item => ({
        adjustment_group_id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        adjustment_type: 'REPLACEMENT_FROM_GODOWN',
        quantity_strips: -item.quantity_strips, // Negative because it's outgoing
        location_type_source: 'GODOWN',
        location_id_source: 'GODOWN',
        location_type_destination: 'CUSTOMER',
        location_id_destination: 'CUSTOMER',
        adjustment_date: replacementDate,
        cost_per_strip: item.cost_per_strip,
        notes: item.notes || notes,
        created_by: profile?.user_id,
      }));

      const allAdjustments = [...returnAdjustments, ...dispatchAdjustments];

      const { error } = await supabase
        .from('stock_adjustments')
        .insert(allAdjustments);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Replacement recorded successfully",
      });

      navigate('/admin/stock/adjustments');
    } catch (error) {
      console.error('Error creating replacement:', error);
      toast({
        title: "Error",
        description: "Failed to create replacement",
        variant: "destructive",
      });
    }
  };

  const getProductName = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    return product ? `${product.product_code} - ${product.product_name}` : '';
  };

  const getBatchNumber = (batchId: string) => {
    const batch = batches?.find(b => b.id === batchId);
    return batch?.batch_number || '';
  };

  const getUnitName = (unitId: string) => {
    const unit = packagingUnits?.find(u => u.id === unitId);
    return unit?.unit_name || '';
  };

  return (
    <div className="container mx-auto p-6">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/stock/adjustments')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Adjustments
          </Button>
          <h1 className="text-3xl font-bold">New Replacement</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Replacement Details */}
          <Card>
            <CardHeader>
              <CardTitle>Replacement Details</CardTitle>
              <CardDescription>
                Record items being returned and dispatched as replacement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="replacementDate">Replacement Date</Label>
                  <Input
                    id="replacementDate"
                    type="date"
                    value={replacementDate}
                    onChange={(e) => setReplacementDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">General Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="General notes for this replacement..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Section Toggle */}
          <div className="flex space-x-2">
            <Button
              type="button"
              variant={currentSection === 'return' ? 'default' : 'outline'}
              onClick={() => setCurrentSection('return')}
            >
              Items to Return
            </Button>
            <Button
              type="button"
              variant={currentSection === 'dispatch' ? 'default' : 'outline'}
              onClick={() => setCurrentSection('dispatch')}
            >
              Items to Dispatch
            </Button>
          </div>

          {/* Add Line Item Form */}
          <Card>
            <CardHeader>
              <CardTitle>
                Add {currentSection === 'return' ? 'Return' : 'Dispatch'} Item
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product">Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.product_code} - {product.product_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="batch">Batch</Label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches?.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batch_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {packagingUnits?.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.unit_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" onClick={addLineItem} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="itemNotes">Item Notes</Label>
                <Input
                  id="itemNotes"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Notes for this item..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Return Items */}
            <Card>
              <CardHeader>
                <CardTitle>Return Items ({returnItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {returnItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No return items added yet</p>
                ) : (
                  <div className="space-y-2">
                    {returnItems.map((item) => (
                      <div key={item.id} className="border rounded p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{getProductName(item.product_id)}</p>
                            <p className="text-xs text-gray-500">Batch: {getBatchNumber(item.batch_id)}</p>
                            <p className="text-xs text-gray-500">
                              {item.quantity} {getUnitName(item.unit_id)} ({item.quantity_strips} strips)
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id, 'return')}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dispatch Items */}
            <Card>
              <CardHeader>
                <CardTitle>Dispatch Items ({dispatchItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {dispatchItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No dispatch items added yet</p>
                ) : (
                  <div className="space-y-2">
                    {dispatchItems.map((item) => (
                      <div key={item.id} className="border rounded p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{getProductName(item.product_id)}</p>
                            <p className="text-xs text-gray-500">Batch: {getBatchNumber(item.batch_id)}</p>
                            <p className="text-xs text-gray-500">
                              {item.quantity} {getUnitName(item.unit_id)} ({item.quantity_strips} strips)
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id, 'dispatch')}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={returnItems.length === 0 || dispatchItems.length === 0}
          >
            Record Replacement
          </Button>
        </form>
      </div>
  );
};

export default NewReplacement;
