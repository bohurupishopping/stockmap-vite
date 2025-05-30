import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { StockTransaction } from '@/pages/StockMovements';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

interface StockTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTransaction: StockTransaction | null;
}

interface FormData {
  product_id: string;
  batch_id: string;
  transaction_type: string;
  quantity_strips: number;
  location_type_source: string;
  location_id_source: string;
  location_type_destination: string;
  location_id_destination: string;
  reference_document_type: string;
  reference_document_id: string;
  cost_per_strip_at_transaction: number;
  notes: string;
}

const StockTransactionModal = ({ isOpen, onClose, onSuccess, editingTransaction }: StockTransactionModalProps) => {
  const { toast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  const form = useForm<FormData>();

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products-for-transactions'],
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
    queryKey: ['batches-for-product', selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return [];
      const { data, error } = await supabase
        .from('product_batches')
        .select('id, batch_number, batch_cost_per_strip')
        .eq('product_id', selectedProductId)
        .eq('status', 'Active')
        .order('batch_number');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProductId,
  });

  useEffect(() => {
    if (editingTransaction) {
      const formData = {
        product_id: editingTransaction.product_id,
        batch_id: editingTransaction.batch_id,
        transaction_type: editingTransaction.transaction_type,
        quantity_strips: editingTransaction.quantity_strips,
        location_type_source: editingTransaction.location_type_source || 'none',
        location_id_source: editingTransaction.location_id_source || '',
        location_type_destination: editingTransaction.location_type_destination || 'none',
        location_id_destination: editingTransaction.location_id_destination || '',
        reference_document_type: editingTransaction.reference_document_type || 'none',
        reference_document_id: editingTransaction.reference_document_id || '',
        cost_per_strip_at_transaction: editingTransaction.cost_per_strip_at_transaction,
        notes: editingTransaction.notes || '',
      };
      form.reset(formData);
      setSelectedProductId(editingTransaction.product_id);
    } else {
      form.reset({
        product_id: '',
        batch_id: '',
        transaction_type: '',
        quantity_strips: 0,
        location_type_source: 'none',
        location_id_source: '',
        location_type_destination: 'none',
        location_id_destination: '',
        reference_document_type: 'none',
        reference_document_id: '',
        cost_per_strip_at_transaction: 0,
        notes: '',
      });
      setSelectedProductId('');
    }
  }, [editingTransaction, form]);

  const onSubmit = async (data: FormData) => {
    try {
      // Convert 'none' values back to null for database storage
      const sourceType = data.location_type_source === 'none' ? null : data.location_type_source;
      const sourceId = data.location_id_source || null;
      const destType = data.location_type_destination === 'none' ? null : data.location_type_destination;
      const destId = data.location_id_destination || null;
      const refType = data.reference_document_type === 'none' ? null : data.reference_document_type;
      const refId = data.reference_document_id || null;
      const groupId = editingTransaction?.transaction_group_id || crypto.randomUUID();
      const transactionDate = new Date().toISOString();

      // Purchase transaction
      if (data.transaction_type === 'STOCK_IN_GODOWN') {
        const purchaseData: TablesInsert<'stock_purchases'> = {
          purchase_group_id: groupId,
          product_id: data.product_id,
          batch_id: data.batch_id,
          quantity_strips: data.quantity_strips,
          supplier_id: sourceId,
          purchase_date: transactionDate,
          reference_document_id: refId,
          cost_per_strip: data.cost_per_strip_at_transaction,
          notes: data.notes,
        };

        if (editingTransaction) {
          const { error } = await supabase
            .from('stock_purchases')
            .update(purchaseData)
            .eq('purchase_id', editingTransaction.transaction_id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('stock_purchases')
            .insert([purchaseData]);

          if (error) throw error;
        }
      }
      // Sale transaction
      else if (['DISPATCH_TO_MR', 'SALE_DIRECT_GODOWN', 'SALE_BY_MR'].includes(data.transaction_type)) {
        const saleData: TablesInsert<'stock_sales'> = {
          sale_group_id: groupId,
          product_id: data.product_id,
          batch_id: data.batch_id,
          transaction_type: data.transaction_type,
          quantity_strips: data.quantity_strips,
          location_type_source: sourceType as string, // Type assertion needed
          location_id_source: sourceId,
          location_type_destination: destType as string, // Type assertion needed
          location_id_destination: destId,
          sale_date: transactionDate,
          reference_document_id: refId,
          cost_per_strip: data.cost_per_strip_at_transaction,
          notes: data.notes,
        };

        if (editingTransaction) {
          const { error } = await supabase
            .from('stock_sales')
            .update(saleData)
            .eq('sale_id', editingTransaction.transaction_id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('stock_sales')
            .insert([saleData]);

          if (error) throw error;
        }
      }
      // Adjustment transaction
      else {
        const adjustmentData: TablesInsert<'stock_adjustments'> = {
          adjustment_group_id: groupId,
          product_id: data.product_id,
          batch_id: data.batch_id,
          adjustment_type: data.transaction_type,
          quantity_strips: data.quantity_strips,
          location_type_source: sourceType,
          location_id_source: sourceId,
          location_type_destination: destType,
          location_id_destination: destId,
          adjustment_date: transactionDate,
          reference_document_id: refId,
          cost_per_strip: data.cost_per_strip_at_transaction,
          notes: data.notes,
        };

        if (editingTransaction) {
          const { error } = await supabase
            .from('stock_adjustments')
            .update(adjustmentData)
            .eq('adjustment_id', editingTransaction.transaction_id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('stock_adjustments')
            .insert([adjustmentData]);

          if (error) throw error;
        }
      }

      toast({
        title: "Success",
        description: editingTransaction ? "Transaction updated successfully." : "Transaction created successfully.",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred while saving the transaction.",
        variant: "destructive",
      });
    }
  };

  const transactionTypes = [
    'STOCK_IN_GODOWN',
    'DISPATCH_TO_MR',
    'SALE_DIRECT_GODOWN',
    'SALE_BY_MR',
    'RETURN_TO_GODOWN',
    'RETURN_TO_MR',
    'ADJUST_DAMAGE_GODOWN',
    'ADJUST_LOSS_GODOWN',
    'ADJUST_DAMAGE_MR',
    'ADJUST_LOSS_MR',
    'ADJUST_EXPIRED_GODOWN',
    'ADJUST_EXPIRED_MR',
    'REPLACEMENT_FROM_GODOWN',
    'REPLACEMENT_FROM_MR',
    'OPENING_STOCK_GODOWN',
    'OPENING_STOCK_MR'
  ];

  const locationTypes = ['SUPPLIER', 'GODOWN', 'MR', 'CUSTOMER', 'WASTAGE_BIN'];
  const referenceDocumentTypes = ['GRN_NUMBER', 'INVOICE_NUMBER', 'DISPATCH_NOTE', 'RETURN_SLIP', 'ADJUSTMENT_ID'];

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    form.setValue('product_id', productId);
    form.setValue('batch_id', ''); // Reset batch selection
    
    // Set default cost from product
    const selectedProduct = products?.find(p => p.id === productId);
    if (selectedProduct) {
      form.setValue('cost_per_strip_at_transaction', selectedProduct.base_cost_per_strip);
    }
  };

  const handleBatchChange = (batchId: string) => {
    form.setValue('batch_id', batchId);
    
    // Update cost from batch if available
    const selectedBatch = batches?.find(b => b.id === batchId);
    const selectedProduct = products?.find(p => p.id === selectedProductId);
    
    if (selectedBatch?.batch_cost_per_strip) {
      form.setValue('cost_per_strip_at_transaction', selectedBatch.batch_cost_per_strip);
    } else if (selectedProduct) {
      form.setValue('cost_per_strip_at_transaction', selectedProduct.base_cost_per_strip);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTransaction ? 'Edit Stock Transaction' : 'Add New Stock Transaction'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Selection */}
              <FormField
                control={form.control}
                name="product_id"
                rules={{ required: 'Product is required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select onValueChange={handleProductChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.product_name} ({product.product_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Batch Selection */}
              <FormField
                control={form.control}
                name="batch_id"
                rules={{ required: 'Batch is required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch</FormLabel>
                    <Select onValueChange={handleBatchChange} value={field.value} disabled={!selectedProductId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {batches?.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.batch_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Transaction Type */}
              <FormField
                control={form.control}
                name="transaction_type"
                rules={{ required: 'Transaction type is required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {transactionTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity_strips"
                rules={{ 
                  required: 'Quantity is required',
                  min: { value: -999999, message: 'Quantity must be a valid number' }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity (Strips)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        placeholder="Enter quantity (positive for inflow, negative for outflow)"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Source Location Type */}
              <FormField
                control={form.control}
                name="location_type_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Location Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {locationTypes.filter(type => type !== 'WASTAGE_BIN').map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Source Location ID */}
              <FormField
                control={form.control}
                name="location_id_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Location ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter source location ID" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Destination Location Type */}
              <FormField
                control={form.control}
                name="location_type_destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination Location Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {locationTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Destination Location ID */}
              <FormField
                control={form.control}
                name="location_id_destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination Location ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter destination location ID" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reference Document Type */}
              <FormField
                control={form.control}
                name="reference_document_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Document Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {referenceDocumentTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reference Document ID */}
              <FormField
                control={form.control}
                name="reference_document_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Document ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter document ID/number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cost per Strip */}
              <FormField
                control={form.control}
                name="cost_per_strip_at_transaction"
                rules={{ 
                  required: 'Cost per strip is required',
                  min: { value: 0.01, message: 'Cost must be greater than 0' }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Strip (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        placeholder="Enter cost per strip"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter any additional notes..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTransaction ? 'Update Transaction' : 'Create Transaction'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default StockTransactionModal;
