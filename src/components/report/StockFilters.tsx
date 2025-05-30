import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
}) => {
  return (
    <Card className="rounded-lg shadow-md border border-gray-300">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Filters</CardTitle>
        <CardDescription className="text-gray-600">
          Filter stock data by various criteria
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div>
            <Label htmlFor="location" className="block mb-1 font-medium text-gray-700">
              Location
            </Label>
            <Select
              value={locationFilter}
              onValueChange={setLocationFilter}
            >
              <SelectTrigger className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-md">
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

          <div>
            <Label htmlFor="product" className="block mb-1 font-medium text-gray-700">
              Product
            </Label>
            <Input
              id="product"
              placeholder="Search products..."
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label htmlFor="category" className="block mb-1 font-medium text-gray-700">
              Category
            </Label>
            <Select
              value={categoryFilter}
              onValueChange={setCategoryFilter}
            >
              <SelectTrigger className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.category_name} value={category.category_name}>
                    {category.category_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="batch" className="block mb-1 font-medium text-gray-700">
              Batch
            </Label>
            <Input
              id="batch"
              placeholder="Search batches..."
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label htmlFor="expiryFrom" className="block mb-1 font-medium text-gray-700">
              Expiry From
            </Label>
            <Input
              id="expiryFrom"
              type="date"
              value={expiryFromDate}
              onChange={(e) => setExpiryFromDate(e.target.value)}
              className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label htmlFor="expiryTo" className="block mb-1 font-medium text-gray-700">
              Expiry To
            </Label>
            <Input
              id="expiryTo"
              type="date"
              value={expiryToDate}
              onChange={(e) => setExpiryToDate(e.target.value)}
              className="rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockFilters; 