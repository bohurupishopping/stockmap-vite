
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, Columns } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

interface ProductTableColumnsProps {
  onColumnToggle?: (visibleColumns: Record<string, boolean>) => void;
}

const defaultColumns: ColumnConfig[] = [
  { key: 'productCode', label: 'Product Code', defaultVisible: true },
  { key: 'productName', label: 'Product Name', defaultVisible: true },
  { key: 'genericName', label: 'Generic Name', defaultVisible: true },
  { key: 'manufacturer', label: 'Manufacturer', defaultVisible: true },
  { key: 'category', label: 'Category', defaultVisible: true },
  { key: 'subCategory', label: 'Sub-Category', defaultVisible: true },
  { key: 'formulation', label: 'Formulation', defaultVisible: true },
  { key: 'baseCost', label: 'Base Cost/Strip', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'godownMin', label: 'Godown Min.', defaultVisible: true },
  { key: 'mrMin', label: 'MR Min.', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true },
];

const STORAGE_KEY = 'product-table-columns';

const ProductTableColumns: React.FC<ProductTableColumnsProps> = ({ onColumnToggle }) => {
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    defaultColumns.reduce((acc, col) => ({
      ...acc,
      [col.key]: col.defaultVisible !== false
    }), {})
  );

  // Load saved column visibility from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setVisibleColumns(prev => ({
          ...prev,
          ...parsed
        }));
      }
    } catch (error) {
      console.error('Failed to load column visibility:', error);
    }
  }, []);

  // Save to localStorage and notify parent when visibility changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
      onColumnToggle?.(visibleColumns);
    } catch (error) {
      console.error('Failed to save column visibility:', error);
    }
  }, [visibleColumns, onColumnToggle]);

  const toggleColumn = (columnKey: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const resetToDefault = () => {
    const defaultVisibility = defaultColumns.reduce((acc, col) => ({
      ...acc,
      [col.key]: col.defaultVisible !== false
    }), {});
    setVisibleColumns(defaultVisibility);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Columns className="h-4 w-4" />
          <span>Columns</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">Table Columns</h4>
              <p className="text-xs text-muted-foreground">Customize the columns in the table</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetToDefault}
              className="text-xs h-8 px-2"
            >
              Reset
            </Button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {defaultColumns.map((column) => (
              <div 
                key={column.key} 
                className="flex items-center space-x-2 py-1.5 hover:bg-muted/50 rounded-md px-2 transition-colors"
              >
                <Checkbox
                  id={`col-${column.key}`}
                  checked={!!visibleColumns[column.key]}
                  onCheckedChange={() => toggleColumn(column.key)}
                  className="rounded-md"
                />
                <label
                  htmlFor={`col-${column.key}`}
                  className={cn(
                    "text-sm font-medium leading-none select-none cursor-pointer",
                    !visibleColumns[column.key] && "text-muted-foreground"
                  )}
                >
                  {column.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProductTableColumns;
