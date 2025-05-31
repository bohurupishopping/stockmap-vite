import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DispatchLineItemProps {
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
  onUpdate: (updates: Partial<DispatchLineItemProps['item']>) => void;
  onRemove: () => void;
  showGodownStock?: boolean;
}

const DispatchLineItem: React.FC<DispatchLineItemProps> = ({
  item,
  onUpdate,
  onRemove,
  showGodownStock = false,
}) => {
  const [availableStock, setAvailableStock] = useState<number>(0);

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products'],
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
        .select('*')
        .eq('product_id', item.product_id)
        .eq('status', 'Active')
        .order('expiry_date');
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
        .select('*')
        .eq('product_id', item.product_id)
        .order('order_in_hierarchy');
      if (error) throw error;
      return data;
    },
    enabled: !!item.product_id,
  });

  // Fetch godown stock for selected batch
  const { data: godownStock } = useQuery({
    queryKey: ['godown-stock', item.batch_id],
    queryFn: async () => {
      if (!item.batch_id || !showGodownStock) return 0;
      
      // Get inflow from purchases
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('stock_purchases')
        .select('quantity_strips')
        .eq('batch_id', item.batch_id);
      
      if (purchaseError) throw purchaseError;
      
      const purchaseInflow = purchaseData?.reduce((sum, tx) => sum + tx.quantity_strips, 0) || 0;
      
      // Get inflow from adjustments (returns, etc.)
      const { data: adjustmentInflowData, error: adjustmentInflowError } = await supabase
        .from('stock_adjustments')
        .select('quantity_strips')
        .eq('batch_id', item.batch_id)
        .eq('location_type_destination', 'GODOWN')
        .gt('quantity_strips', 0);
      
      if (adjustmentInflowError) throw adjustmentInflowError;
      
      const adjustmentInflow = adjustmentInflowData?.reduce((sum, tx) => sum + tx.quantity_strips, 0) || 0;
      
      // Get outflow from sales
      const { data: salesData, error: salesError } = await supabase
        .from('stock_sales')
        .select('quantity_strips')
        .eq('batch_id', item.batch_id)
        .eq('location_type_source', 'GODOWN');
      
      if (salesError) throw salesError;
      
      const salesOutflow = salesData?.reduce((sum, tx) => sum + Math.abs(tx.quantity_strips), 0) || 0;
      
      // Get outflow from adjustments (damages, losses, etc.)
      const { data: adjustmentOutflowData, error: adjustmentOutflowError } = await supabase
        .from('stock_adjustments')
        .select('quantity_strips')
        .eq('batch_id', item.batch_id)
        .eq('location_type_source', 'GODOWN')
        .lt('quantity_strips', 0);
      
      if (adjustmentOutflowError) throw adjustmentOutflowError;
      
      const adjustmentOutflow = adjustmentOutflowData?.reduce((sum, tx) => sum + Math.abs(tx.quantity_strips), 0) || 0;
      
      // Calculate total stock
      const totalInflow = purchaseInflow + adjustmentInflow;
      const totalOutflow = salesOutflow + adjustmentOutflow;
      
      return Math.max(0, totalInflow - totalOutflow);
    },
    enabled: !!item.batch_id && showGodownStock,
  });

  useEffect(() => {
    if (godownStock !== undefined) {
      setAvailableStock(godownStock);
    }
  }, [godownStock]);

  // Calculate quantity in strips when quantity or unit changes
  useEffect(() => {
    if (item.quantity && item.unit_id && packagingUnits) {
      const selectedUnit = packagingUnits.find(unit => unit.id === item.unit_id);
      if (selectedUnit) {
        const quantityInStrips = item.quantity * selectedUnit.conversion_factor_to_strips;
        onUpdate({ quantity_strips: quantityInStrips });
      }
    }
  }, [item.quantity, item.unit_id, packagingUnits]);

  // Update cost per strip when batch changes
  useEffect(() => {
    if (item.batch_id && batches) {
      const selectedBatch = batches.find(batch => batch.id === item.batch_id);
      if (selectedBatch?.batch_cost_per_strip) {
        onUpdate({ cost_per_strip: selectedBatch.batch_cost_per_strip });
      } else if (item.product_id && products) {
        const selectedProduct = products.find(product => product.id === item.product_id);
        if (selectedProduct) {
          onUpdate({ cost_per_strip: selectedProduct.base_cost_per_strip });
        }
      }
    }
  }, [item.batch_id, batches, item.product_id, products]);

  const selectedProduct = products?.find(p => p.id === item.product_id);
  const selectedBatch = batches?.find(b => b.id === item.batch_id);
  const isQuantityExceeded = showGodownStock && item.quantity_strips > availableStock;

  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex flex-wrap items-start gap-4">
        {/* Product Selection */}
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs font-medium text-gray-600">Product *</Label>
          <Select 
            value={item.product_id} 
            onValueChange={(value) => onUpdate({ 
              product_id: value, 
              batch_id: '', 
              unit_id: '',
              quantity: 0,
              quantity_strips: 0 
            })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {products?.map((product) => (
                <SelectItem key={product.id} value={product.id} className="text-sm">
                  {product.product_name} ({product.product_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Batch Selection */}
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs font-medium text-gray-600">Batch *</Label>
          <div className="flex items-center gap-2">
            <Select 
              value={item.batch_id} 
              onValueChange={(value) => onUpdate({ batch_id: value })}
              disabled={!item.product_id}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {batches?.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id} className="text-sm">
                    {batch.batch_number} (Exp: {new Date(batch.expiry_date).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBatch && showGodownStock && (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Stock: {availableStock}
              </span>
            )}
          </div>
        </div>

        {/* Quantity */}
        <div className="w-24">
          <Label className="text-xs font-medium text-gray-600">Qty *</Label>
          <Input
            type="number"
            value={item.quantity || ''}
            onChange={(e) => onUpdate({ quantity: parseInt(e.target.value) || 0 })}
            placeholder="Qty"
            min="1"
            className="h-8 text-sm"
          />
        </div>

        {/* Unit */}
        <div className="w-32">
          <Label className="text-xs font-medium text-gray-600">Unit *</Label>
          <Select 
            value={item.unit_id} 
            onValueChange={(value) => onUpdate({ unit_id: value })}
            disabled={!item.product_id}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {packagingUnits?.map((unit) => (
                <SelectItem key={unit.id} value={unit.id} className="text-sm">
                  {unit.unit_name} ({unit.conversion_factor_to_strips})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Strips */}
        <div className="w-24">
          <Label className="text-xs font-medium text-gray-600">Strips</Label>
          <Input
            value={item.quantity_strips || 0}
            readOnly
            className="h-8 bg-gray-50 text-sm"
          />
        </div>

        {/* Cost */}
        <div className="w-24">
          <Label className="text-xs font-medium text-gray-600">Cost/Strip</Label>
          <Input
            value={item.cost_per_strip?.toFixed(2) || '0.00'}
            readOnly
            className="h-8 bg-gray-50 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-end gap-2 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowNotes(!showNotes)}
            className="h-8 w-8 text-gray-500 hover:bg-gray-200"
          >
            {showNotes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Validation Alert */}
      {isQuantityExceeded && (
        <div className="mt-2">
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Quantity ({item.quantity_strips} strips) exceeds available stock ({availableStock} strips)
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Collapsible Notes */}
      {showNotes && (
        <div className="mt-3 pt-3 border-t">
          <Label className="text-xs font-medium text-gray-600">Notes</Label>
          <Textarea
            value={item.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Add notes for this line item (optional)"
            rows={2}
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
};

export default DispatchLineItem;
