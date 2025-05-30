import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RotateCcw, RefreshCw, AlertTriangle, Loader2, Trash2, Edit, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

export interface StockAdjustment {
  adjustment_id: string;
  adjustment_group_id: string;
  product_id: string;
  batch_id: string;
  adjustment_type: string;
  quantity_strips: number;
  location_type_source: string | null;
  location_id_source: string | null;
  location_type_destination: string | null;
  location_id_destination: string | null;
  adjustment_date: string;
  reference_document_id: string | null;
  cost_per_strip: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  products?: {
    product_name: string;
    product_code: string;
  };
  product_batches?: {
    batch_number: string;
  };
}

// Define schema for form validation
const editAdjustmentSchema = z.object({
  quantity_strips: z.number().min(0.01, "Quantity must be greater than 0"),
  location_type_source: z.string(),
  location_id_source: z.string().optional(),
  location_type_destination: z.string(),
  location_id_destination: z.string().optional(),
  adjustment_date: z.string().min(1, "Date is required"),
  cost_per_strip: z.number().min(0.01, "Cost must be greater than 0"),
  notes: z.string().optional(),
});

type EditAdjustmentFormData = z.infer<typeof editAdjustmentSchema>;

const StockAdjustments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<StockAdjustment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState('all');

  const form = useForm<EditAdjustmentFormData>({
    resolver: zodResolver(editAdjustmentSchema),
    defaultValues: {
      quantity_strips: 0,
      location_type_source: 'none',
      location_id_source: '',
      location_type_destination: 'none',
      location_id_destination: '',
      adjustment_date: '',
      cost_per_strip: 0,
      notes: '',
    }
  });

  const fetchAdjustments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_adjustments')
        .select(`
          *,
          products:product_id(product_name, product_code),
          product_batches:batch_id(batch_number)
        `)
        .order('adjustment_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAdjustments(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch adjustments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getAdjustmentTypeBadgeVariant = (type: string) => {
    if (type.includes('RETURN')) {
      return 'default';
    }
    if (type.includes('REPLACEMENT')) {
      return 'secondary';
    }
    if (type.includes('DAMAGE') || type.includes('LOSS') || type.includes('EXPIRED')) {
      return 'destructive';
    }
    return 'outline';
  };

  const handleDeleteClick = (adjustmentId: string) => {
    setAdjustmentToDelete(adjustmentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!adjustmentToDelete) return;
    
    try {
      const { error } = await supabase
        .from('stock_adjustments')
        .delete()
        .eq('adjustment_id', adjustmentToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Adjustment deleted successfully",
      });
      
      // Refresh the adjustments list
      fetchAdjustments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete adjustment",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setAdjustmentToDelete(null);
    }
  };

  const handleEditClick = (adjustment: StockAdjustment) => {
    setEditingAdjustment(adjustment);
    
    // Convert adjustment date to YYYY-MM-DD format for the input field
    const formattedDate = new Date(adjustment.adjustment_date).toISOString().split('T')[0];
    
    form.reset({
      quantity_strips: adjustment.quantity_strips,
      location_type_source: adjustment.location_type_source || 'none',
      location_id_source: adjustment.location_id_source || '',
      location_type_destination: adjustment.location_type_destination || 'none',
      location_id_destination: adjustment.location_id_destination || '',
      adjustment_date: formattedDate,
      cost_per_strip: adjustment.cost_per_strip,
      notes: adjustment.notes || '',
    });
    
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (data: EditAdjustmentFormData) => {
    if (!editingAdjustment) return;
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('stock_adjustments')
        .update({
          quantity_strips: data.quantity_strips,
          location_type_source: data.location_type_source === 'none' ? null : data.location_type_source,
          location_id_source: data.location_id_source || null,
          location_type_destination: data.location_type_destination === 'none' ? null : data.location_type_destination,
          location_id_destination: data.location_id_destination || null,
          adjustment_date: data.adjustment_date,
          cost_per_strip: data.cost_per_strip,
          notes: data.notes || null,
        })
        .eq('adjustment_id', editingAdjustment.adjustment_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Adjustment updated successfully",
      });
      
      setEditDialogOpen(false);
      setEditingAdjustment(null);
      fetchAdjustments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update adjustment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const locationTypes = ['GODOWN', 'MR', 'CUSTOMER', 'SUPPLIER', 'DAMAGE', 'LOSS', 'EXPIRED'];

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Adjustments</h1>
          <p className="text-gray-600">Manage returns, replacements, and stock adjustments</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-40 rounded-full border-0 focus-visible:ring-1"
              />
            </div>
            
            <select
              value={adjustmentTypeFilter}
              onChange={(e) => setAdjustmentTypeFilter(e.target.value)}
              className="h-8 px-2 rounded-full text-sm bg-white border-0 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="RETURN">Returns</option>
              <option value="REPLACEMENT">Replacements</option>
              <option value="DAMAGE">Damage</option>
              <option value="LOSS">Loss</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Button 
              onClick={() => navigate('/admin/stock/adjustments/returns/new')} 
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Return
            </Button>
            <Button 
              onClick={() => navigate('/admin/stock/adjustments/replacements/new')} 
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Replacement
            </Button>
            <Button 
              onClick={() => navigate('/admin/stock/adjustments/damage-loss/new')} 
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Adjustment
            </Button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${adjustments?.length || 0} adjustments found`}
        </p>
      </div>

     

      {/* Recent Adjustments */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Recent Stock Adjustments</h2>
          <Button variant="outline" size="sm" onClick={fetchAdjustments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading adjustments...</span>
            </div>
          ) : adjustments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent adjustments found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Product</TableHead>
                    <TableHead className="w-[100px]">Batch</TableHead>
                    <TableHead className="w-[150px]">Adjustment Type</TableHead>
                    <TableHead className="w-[100px] text-center">Quantity</TableHead>
                    <TableHead className="w-[150px]">From</TableHead>
                    <TableHead className="w-[150px]">To</TableHead>
                    <TableHead className="w-[100px]">Cost/Strip</TableHead>
                    <TableHead className="w-[150px]">Date</TableHead>
                    <TableHead className="w-[200px]">Notes</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adjustment) => (
                    <TableRow key={adjustment.adjustment_id} className="hover:bg-gray-50">
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {adjustment.products?.product_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {adjustment.products?.product_code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {adjustment.product_batches?.batch_number}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAdjustmentTypeBadgeVariant(adjustment.adjustment_type)}>
                          {adjustment.adjustment_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                          adjustment.quantity_strips > 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {adjustment.quantity_strips > 0 ? '+' : ''}{adjustment.quantity_strips}
                        </span>
                      </TableCell>
                      <TableCell>
                        {adjustment.location_type_source && (
                          <div className="text-sm">
                            <div className="font-medium">{adjustment.location_type_source}</div>
                            {adjustment.location_id_source && (
                              <div className="text-gray-500 text-xs">{adjustment.location_id_source}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {adjustment.location_type_destination && (
                          <div className="text-sm">
                            <div className="font-medium">{adjustment.location_type_destination}</div>
                            {adjustment.location_id_destination && (
                              <div className="text-gray-500 text-xs">{adjustment.location_id_destination}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          ₹{adjustment.cost_per_strip}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{formatDate(adjustment.adjustment_date)}</div>
                          <div className="text-gray-500 text-xs">{formatDate(adjustment.created_at)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 line-clamp-2">
                          {adjustment.notes || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditClick(adjustment)}
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteClick(adjustment.adjustment_id)}
                            className="h-8 w-8 p-0 hover:bg-red-50 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this stock adjustment record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Adjustment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Stock Adjustment</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="adjustment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adjustment Date*</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity_strips"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity (Strips)*</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseFloat(e.target.value))} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location_type_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Location Type*</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source type" />
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
                <FormField
                  control={form.control}
                  name="location_id_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Location ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location_type_destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Location Type*</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                      >
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
                <FormField
                  control={form.control}
                  name="location_id_destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Location ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="cost_per_strip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Strip (₹)*</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value))} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockAdjustments;
