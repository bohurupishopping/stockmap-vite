
import React, { useState } from 'react';
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

interface AdjustmentLineItem {
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

const NewDamageLoss = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjustmentType, setAdjustmentType] = useState('Damage');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<AdjustmentLineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [itemNotes, setItemNotes] = useState('');

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

    const newItem: AdjustmentLineItem = {
      id: Math.random().toString(36).substr(2, 9),
      product_id: selectedProduct,
      batch_id: selectedBatch,
      quantity: parseInt(quantity),
      unit_id: selectedUnit,
      quantity_strips: quantityStrips,
      cost_per_strip: costPerStrip,
      notes: itemNotes,
    };

    setLineItems([...lineItems, newItem]);
    
    // Reset form
    setSelectedProduct('');
    setSelectedBatch('');
    setSelectedUnit('');
    setQuantity('');
    setItemNotes('');
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lineItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    try {
      const transactionGroupId = crypto.randomUUID();

      // Create stock transactions for damage/loss (negative quantities as they're leaving stock)
      const transactions = lineItems.map(item => ({
        transaction_type: adjustmentType,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity_strips: -item.quantity_strips, // Negative because it's leaving stock
        cost_per_strip_at_transaction: item.cost_per_strip,
        transaction_date: adjustmentDate,
        transaction_group_id: transactionGroupId,
        location_type_source: 'GODOWN',
        location_id_source: 'GODOWN',
        location_type_destination: adjustmentType.toUpperCase(),
        location_id_destination: adjustmentType.toUpperCase(),
        notes: item.notes,
        created_by: profile?.user_id,
      }));

      const { error } = await supabase
        .from('stock_transactions')
        .insert(transactions);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${adjustmentType} adjustment recorded successfully`,
      });

      navigate('/admin/stock/adjustments');
    } catch (error) {
      console.error('Error creating adjustment:', error);
      toast({
        title: "Error",
        description: "Failed to create adjustment",
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

  const calculateTotal = () => {
    return lineItems.reduce((total, item) => {
      return total + (item.quantity_strips * item.cost_per_strip);
    }, 0);
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
          <h1 className="text-3xl font-bold">New {adjustmentType} Adjustment</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Adjustment Details Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Adjustment Details</CardTitle>
                <CardDescription>
                  Record items that are damaged or lost
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="adjustmentDate">Adjustment Date</Label>
                    <Input
                      id="adjustmentDate"
                      type="date"
                      value={adjustmentDate}
                      onChange={(e) => setAdjustmentDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="adjustmentType">Adjustment Type</Label>
                    <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Damage">Damage</SelectItem>
                        <SelectItem value="Loss">Loss</SelectItem>
                        <SelectItem value="Expiry">Expiry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes for this adjustment..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add Line Item Form */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Add Item</CardTitle>
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
                    <Button onClick={addLineItem} className="w-full">
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
          </div>

          {/* Line Items Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>{adjustmentType} Items ({lineItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {lineItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No items added yet</p>
                ) : (
                  <div className="space-y-2">
                    {lineItems.map((item) => (
                      <div key={item.id} className="border rounded p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{getProductName(item.product_id)}</p>
                            <p className="text-xs text-gray-500">Batch: {getBatchNumber(item.batch_id)}</p>
                            <p className="text-xs text-gray-500">
                              {item.quantity} {getUnitName(item.unit_id)} ({item.quantity_strips} strips)
                            </p>
                            <p className="text-xs font-medium text-red-600">
                              Loss: ₹{(item.quantity_strips * item.cost_per_strip).toFixed(2)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2">
                      <p className="font-semibold text-red-600">
                        Total Loss: ₹{calculateTotal().toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              onClick={handleSubmit} 
              className="w-full mt-4"
              disabled={lineItems.length === 0}
            >
              Record {adjustmentType}
            </Button>
          </div>
        </div>
      </div>
  );
};

export default NewDamageLoss;
