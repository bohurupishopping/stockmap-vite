
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ProductBatch } from '@/components/products/ProductBatches';

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingBatch: ProductBatch | null;
  productId: string;
  product: {
    id: string;
    product_name: string;
    product_code: string;
    base_cost_per_strip: number;
  };
}

const BatchModal = ({ isOpen, onClose, onSuccess, editingBatch, productId, product }: BatchModalProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    batch_number: '',
    manufacturing_date: '',
    expiry_date: '',
    batch_cost_per_strip: '',
    status: 'Active',
    notes: '',
  });

  useEffect(() => {
    if (editingBatch) {
      setFormData({
        batch_number: editingBatch.batch_number,
        manufacturing_date: editingBatch.manufacturing_date,
        expiry_date: editingBatch.expiry_date,
        batch_cost_per_strip: editingBatch.batch_cost_per_strip?.toString() || '',
        status: editingBatch.status,
        notes: editingBatch.notes || '',
      });
    } else {
      setFormData({
        batch_number: '',
        manufacturing_date: '',
        expiry_date: '',
        batch_cost_per_strip: '',
        status: 'Active',
        notes: '',
      });
    }
  }, [editingBatch, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.batch_number || !formData.manufacturing_date || !formData.expiry_date) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      // Date validation
      const manufacturingDate = new Date(formData.manufacturing_date);
      const expiryDate = new Date(formData.expiry_date);
      
      if (expiryDate <= manufacturingDate) {
        toast({
          title: "Validation Error",
          description: "Expiry date must be after manufacturing date.",
          variant: "destructive",
        });
        return;
      }

      const batchData = {
        product_id: productId,
        batch_number: formData.batch_number,
        manufacturing_date: formData.manufacturing_date,
        expiry_date: formData.expiry_date,
        batch_cost_per_strip: formData.batch_cost_per_strip ? parseFloat(formData.batch_cost_per_strip) : null,
        status: formData.status,
        notes: formData.notes || null,
      };

      if (editingBatch) {
        const { error } = await supabase
          .from('product_batches')
          .update(batchData)
          .eq('id', editingBatch.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Batch updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from('product_batches')
          .insert(batchData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Batch created successfully.",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred while saving the batch.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingBatch ? 'Edit Batch' : 'Add New Batch'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Display */}
          <div>
            <Label>Product</Label>
            <div className="p-2 bg-gray-50 rounded text-sm">
              {product.product_name} ({product.product_code})
            </div>
          </div>

          {/* Batch Number */}
          <div>
            <Label htmlFor="batch_number">
              Batch Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="batch_number"
              value={formData.batch_number}
              onChange={(e) => setFormData(prev => ({ ...prev, batch_number: e.target.value }))}
              placeholder="Enter batch number"
              required
            />
          </div>

          {/* Manufacturing Date */}
          <div>
            <Label htmlFor="manufacturing_date">
              Manufacturing Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="manufacturing_date"
              type="date"
              value={formData.manufacturing_date}
              onChange={(e) => setFormData(prev => ({ ...prev, manufacturing_date: e.target.value }))}
              required
            />
          </div>

          {/* Expiry Date */}
          <div>
            <Label htmlFor="expiry_date">
              Expiry Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="expiry_date"
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
              required
            />
          </div>

          {/* Batch Cost per Strip */}
          <div>
            <Label htmlFor="batch_cost_per_strip">
              Batch Cost per Strip (Optional)
            </Label>
            <Input
              id="batch_cost_per_strip"
              type="number"
              step="0.01"
              min="0"
              value={formData.batch_cost_per_strip}
              onChange={(e) => setFormData(prev => ({ ...prev, batch_cost_per_strip: e.target.value }))}
              placeholder={`Leave blank to use base cost (₹${product.base_cost_per_strip})`}
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Recalled">Recalled</SelectItem>
                <SelectItem value="Quarantined">Quarantined</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes about this batch"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting 
                ? (editingBatch ? 'Updating...' : 'Creating...') 
                : (editingBatch ? 'Update Batch' : 'Save Batch')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BatchModal;
