
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RotateCcw, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

const StockAdjustments = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Adjustments</h1>
          <p className="text-gray-600 mt-1">Manage returns, replacements, and stock adjustments</p>
        </div>
      </div>

      {/* Adjustment Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Returns */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/stock/adjustments/returns/new')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <RotateCcw className="h-6 w-6 text-blue-600" />
              Returns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Process returns to godown or MR stock from customers or field
            </p>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              New Return
            </Button>
          </CardContent>
        </Card>

        {/* Replacements */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/stock/adjustments/replacements/new')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 text-green-600" />
              Replacements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Process product replacements for faulty or damaged items
            </p>
            <Button className="w-full" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              New Replacement
            </Button>
          </CardContent>
        </Card>

        {/* Damage/Loss */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/stock/adjustments/damage-loss/new')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              Damage/Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Record stock damage or loss adjustments in godown or MR stock
            </p>
            <Button className="w-full" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Record Adjustment
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Adjustments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Adjustments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Recent adjustment history will appear here
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockAdjustments;
