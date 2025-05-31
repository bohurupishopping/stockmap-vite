import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface StockFiltersProps {
  locationFilter: string;
  setLocationFilter: (value: string) => void;
  productFilter: string;
  setProductFilter: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  batchFilter: string;
  setBatchFilter: (value: string) => void;
  expiryFromDate: string;
  setExpiryFromDate: (value: string) => void;
  expiryToDate: string;
  setExpiryToDate: (value: string) => void;
  categories?: { category_name: string }[];
  mrUsers?: { user_id: string; name: string }[];
  onClearFilters?: () => void;
}

const StockFilters: React.FC<StockFiltersProps> = ({
  locationFilter,
  setLocationFilter,
  productFilter,
  setProductFilter,
  categoryFilter,
  setCategoryFilter,
  batchFilter,
  setBatchFilter,
  expiryFromDate,
  setExpiryFromDate,
  expiryToDate,
  setExpiryToDate,
  categories,
  mrUsers,
  onClearFilters
}) => {
  return (
    <Card className="rounded-lg border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">Filters</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Filter stock data by various criteria
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onClearFilters}
          className="h-8 px-3 rounded-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium">
              Location
            </Label>
            <Select
              value={locationFilter}
              onValueChange={setLocationFilter}
            >
              <SelectTrigger className="h-8 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Locations</SelectItem>
                <SelectItem value="GODOWN">Main Godown</SelectItem>
                <SelectItem value="MR">All MRs</SelectItem>
                {mrUsers?.map((user) => (
                  <SelectItem key={user.user_id} value={`MR_${user.user_id}`}>
                    MR: {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product" className="text-sm font-medium">
              Product
            </Label>
            <Input
              id="product"
              placeholder="Search products..."
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="h-8 rounded-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">
              Category
            </Label>
            <Select
              value={categoryFilter}
              onValueChange={setCategoryFilter}
            >
              <SelectTrigger className="h-8 rounded-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.category_name} value={category.category_name}>
                    {category.category_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch" className="text-sm font-medium">
              Batch
            </Label>
            <Input
              id="batch"
              placeholder="Search batches..."
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="h-8 rounded-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryFrom" className="text-sm font-medium">
              Expiry From
            </Label>
            <Input
              id="expiryFrom"
              type="date"
              value={expiryFromDate}
              onChange={(e) => setExpiryFromDate(e.target.value)}
              className="h-8 rounded-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryTo" className="text-sm font-medium">
              Expiry To
            </Label>
            <Input
              id="expiryTo"
              type="date"
              value={expiryToDate}
              onChange={(e) => setExpiryToDate(e.target.value)}
              className="h-8 rounded-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockFilters;