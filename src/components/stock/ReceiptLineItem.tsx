import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus } from 'lucide-react';

interface ReceiptLineItemProps {
  item: {
    id: string;
    product_id: string;
    batch_id: string;
    quantity: number;
    unit_id: string;
    quantity_strips: number;
    cost_per_strip: number;
    notes: string;
  };
  onUpdate: (updates: any) => void;
  onRemove: () => void;
  onCreateBatch: (productId: string) => void;
}

const ReceiptLineItem = ({ item, onUpdate, onRemove, onCreateBatch }: ReceiptLineItemProps) => {
  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products-for-receipt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, product_code, base_cost_per_strip')
        .eq('is_active', true)
        .order('product_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch batches for selected product
  const { data: batches } = useQuery({
    queryKey: ['product-batches', item.product_id],
    queryFn: async () => {
      if (!item.product_id) return [];
      const { data, error } = await supabase
        .from('product_batches')
        .select('id, batch_number, batch_cost_per_strip, expiry_date')
        .eq('product_id', item.product_id)
        .eq('status', 'Active')
        .order('batch_number');
      if (error) throw error;
      return data;
    },
    enabled: !!item.product_id,
  });

  // Fetch packaging units for selected product
  const { data: packagingUnits } = useQuery({
    queryKey: ['packaging-units', item.product_id],
    queryFn: async () => {
      if (!item.product_id) return [];
      const { data, error } = await supabase
        .from('product_packaging_units')
        .select('id, unit_name, conversion_factor_to_strips, default_purchase_unit')
        .eq('product_id', item.product_id)
        .order('order_in_hierarchy');
      if (error) throw error;
      return data;
    },
    enabled: !!item.product_id,
  });

  const handleProductChange = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    onUpdate({
      product_id: productId,
      batch_id: '',
      unit_id: '',
      cost_per_strip: product?.base_cost_per_strip || 0,
    });
  };

  const handleBatchChange = (batchId: string) => {
    const batch = batches?.find(b => b.id === batchId);
    onUpdate({
      batch_id: batchId,
      cost_per_strip: batch?.batch_cost_per_strip || item.cost_per_strip,
    });
  };

  const handleQuantityChange = (quantity: number) => {
    const unit = packagingUnits?.find(u => u.id === item.unit_id);
    const conversionFactor = unit?.conversion_factor_to_strips || 1;
    const quantityStrips = quantity * conversionFactor;
    
    onUpdate({
      quantity,
      quantity_strips: quantityStrips,
    });
  };

  const handleUnitChange = (unitId: string) => {
    const unit = packagingUnits?.find(u => u.id === unitId);
    const conversionFactor = unit?.conversion_factor_to_strips || 1;
    const quantityStrips = item.quantity * conversionFactor;
    
    onUpdate({
      unit_id: unitId,
      quantity_strips: quantityStrips,
    });
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <h4 className="font-medium">Product Line</h4>
          <Button variant="outline" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Product *</Label>
            <Select value={item.product_id} onValueChange={handleProductChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.product_name} ({product.product_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Batch *</Label>
            <div className="flex gap-2">
              <Select value={item.batch_id} onValueChange={handleBatchChange} disabled={!item.product_id}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches?.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.batch_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => item.product_id && onCreateBatch(item.product_id)}
                disabled={!item.product_id}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>Unit *</Label>
            <Select value={item.unit_id} onValueChange={handleUnitChange} disabled={!item.product_id}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {packagingUnits?.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.unit_name} ({unit.conversion_factor_to_strips} strips)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantity *</Label>
            <Input
              type="number"
              value={item.quantity}
              onChange={(e) => handleQuantityChange(Number(e.target.value))}
              placeholder="Enter quantity"
              min="0"
              step="1"
            />
          </div>

          <div>
            <Label>Quantity (Strips)</Label>
            <Input
              value={item.quantity_strips}
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div>
            <Label>Cost per Strip</Label>
            <Input
              type="number"
              value={item.cost_per_strip}
              onChange={(e) => onUpdate({ cost_per_strip: Number(e.target.value) })}
              placeholder="Cost per strip"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Line Notes</Label>
          <Textarea
            value={item.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Enter any notes for this line item"
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ReceiptLineItem;
