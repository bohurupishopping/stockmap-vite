
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AdditionalProductInfoProps {
  formData: any;
  updateFormData: (updates: any) => void;
}

const AdditionalProductInfo = ({ formData, updateFormData }: AdditionalProductInfoProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Storage & Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storage_conditions">Storage Conditions</Label>
            <Textarea
              id="storage_conditions"
              value={formData.storage_conditions}
              onChange={(e) => updateFormData({ storage_conditions: e.target.value })}
              placeholder="Enter storage requirements (e.g., Store in cool, dry place. Keep away from direct sunlight.)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">Product Image URL</Label>
            <Input
              id="image_url"
              type="url"
              value={formData.image_url}
              onChange={(e) => updateFormData({ image_url: e.target.value })}
              placeholder="https://example.com/product-image.jpg"
            />
            <p className="text-xs text-gray-500">
              Enter a URL to the product image. Consider using Supabase Storage for file uploads.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_stock_godown">Minimum Stock Level (Godown)</Label>
              <Input
                id="min_stock_godown"
                type="number"
                min="0"
                value={formData.min_stock_level_godown}
                onChange={(e) => updateFormData({ min_stock_level_godown: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-gray-500">Alert when godown stock falls below this level</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_stock_mr">Minimum Stock Level (MR)</Label>
              <Input
                id="min_stock_mr"
                type="number"
                min="0"
                value={formData.min_stock_level_mr}
                onChange={(e) => updateFormData({ min_stock_level_mr: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-gray-500">Alert when MR stock falls below this level</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead_time">Lead Time (Days)</Label>
            <Input
              id="lead_time"
              type="number"
              min="0"
              value={formData.lead_time_days}
              onChange={(e) => updateFormData({ lead_time_days: e.target.value })}
              placeholder="0"
            />
            <p className="text-xs text-gray-500">
              Expected number of days between order placement and delivery
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div>
              <h4 className="font-medium text-blue-900">Next Steps</h4>
              <p className="text-sm text-blue-700 mt-1">
                After saving this product, you'll be able to manage packaging units and batches 
                from the product details page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdditionalProductInfo;
