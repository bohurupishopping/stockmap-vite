import { supabase } from '@/integrations/supabase/client';
import { StockItem, StockSummary, Product, Batch, Transaction, StockFilters } from '@/types/stock';

/**
 * Calculates stock data based on transactions and filters
 */
export async function calculateStockData(filters: StockFilters): Promise<StockItem[]> {
  try {
    // First, fetch all products for later lookup
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        product_name,
        product_code,
        generic_name,
        min_stock_level_godown,
        min_stock_level_mr,
        product_categories (
          category_name
        )
      `);
    
    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw productsError;
    }
    
    // Create a map of products for quick lookup
    const productMap = new Map<string, Product>();
    products?.forEach(product => {
      productMap.set(product.id, product);
    });
    
    // Fetch all batches for later lookup
    const { data: batches, error: batchesError } = await supabase
      .from('product_batches')
      .select(`
        id,
        batch_number,
        expiry_date
      `);
    
    if (batchesError) {
      console.error('Error fetching batches:', batchesError);
      throw batchesError;
    }
    
    // Create a map of batches for quick lookup
    const batchMap = new Map<string, Batch>();
    batches?.forEach(batch => {
      batchMap.set(batch.id, batch);
    });

    // Build query for transactions
    let query = supabase
      .from('stock_transactions_view')
      .select(`
        product_id,
        batch_id,
        transaction_type,
        quantity_strips,
        location_type_source,
        location_id_source,
        location_type_destination,
        location_id_destination,
        cost_per_strip_at_transaction,
        transaction_date
      `);

    // Apply filters
    if (filters.productFilter) {
      // Get product IDs that match the filter
      const filteredProductIds = products
        ?.filter(p => 
          p.product_name.toLowerCase().includes(filters.productFilter.toLowerCase()) || 
          p.product_code.toLowerCase().includes(filters.productFilter.toLowerCase())
        )
        .map(p => p.id);
      
      if (filteredProductIds && filteredProductIds.length > 0) {
        query = query.in('product_id', filteredProductIds);
      } else {
        // No products match the filter, return empty result
        return [];
      }
    }

    if (filters.batchFilter) {
      // Get batch IDs that match the filter
      const filteredBatchIds = batches
        ?.filter(b => b.batch_number.toLowerCase().includes(filters.batchFilter.toLowerCase()))
        .map(b => b.id);
      
      if (filteredBatchIds && filteredBatchIds.length > 0) {
        query = query.in('batch_id', filteredBatchIds);
      } else {
        // No batches match the filter, return empty result
        return [];
      }
    }

    if (filters.expiryFromDate && filters.expiryToDate) {
      // Get batch IDs that match the expiry date range
      const filteredBatchIds = batches
        ?.filter(b => {
          const expiryDate = new Date(b.expiry_date);
          const fromDate = new Date(filters.expiryFromDate);
          const toDate = new Date(filters.expiryToDate);
          return expiryDate >= fromDate && expiryDate <= toDate;
        })
        .map(b => b.id);
      
      if (filteredBatchIds && filteredBatchIds.length > 0) {
        query = query.in('batch_id', filteredBatchIds);
      } else {
        // No batches match the filter, return empty result
        return [];
      }
    }

    const { data: transactions, error } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    // Apply category filter if needed
    let filteredData = transactions || [];
    if (filters.categoryFilter && filters.categoryFilter !== 'ALL') {
      filteredData = filteredData.filter(tx => {
        const product = productMap.get(tx.product_id);
        if (!product || !product.product_categories) return false;
        
        // Handle both array and object responses from Supabase
        const categories = Array.isArray(product.product_categories) 
          ? product.product_categories 
          : [product.product_categories];
        
        return categories.some((cat: any) => cat.category_name === filters.categoryFilter);
      });
    }

    // Calculate actual stock by processing all transactions
    const stockMap = new Map<string, StockItem>();

    filteredData.forEach((transaction: Transaction) => {
      try {
        // Get product and batch data from our maps
        const product = productMap.get(transaction.product_id);
        const batch = batchMap.get(transaction.batch_id);
        
        // Skip transactions with missing related data
        if (!product || !batch) {
          return;
        }
        
        // Helper function to get or create a stock item entry
        const getOrCreateStockItem = (productId: string, batchId: string, locationType: string, locationId: string) => {
          const key = `${productId}_${batchId}_${locationType}_${locationId}`;
          
          if (!stockMap.has(key)) {
            // Handle both array and object responses from Supabase
            const categories = Array.isArray(product.product_categories) 
              ? product.product_categories 
              : product.product_categories ? [product.product_categories] : [];
            
            stockMap.set(key, {
              product_id: productId,
              product_name: product.product_name,
              product_code: product.product_code,
              generic_name: product.generic_name,
              batch_id: batchId,
              batch_number: batch.batch_number,
              expiry_date: batch.expiry_date,
              location_type: locationType,
              location_id: locationId,
              current_quantity_strips: 0,
              cost_per_strip: transaction.cost_per_strip_at_transaction,
              total_value: 0,
              category_name: categories[0]?.category_name,
              min_stock_level_godown: product.min_stock_level_godown,
              min_stock_level_mr: product.min_stock_level_mr,
            });
          }
          
          return stockMap.get(key)!;
        };
        
        // Process transaction based on type
        processTransaction(transaction, getOrCreateStockItem, filters.locationFilter);
        
      } catch (err) {
        console.error('Error processing transaction:', err, transaction);
      }
    });

    // Calculate total value and filter out zero/negative stock items
    const stockItems = Array.from(stockMap.values())
      .filter(item => item.current_quantity_strips > 0)
      .map(item => ({
        ...item,
        total_value: item.current_quantity_strips * item.cost_per_strip
      }));

    return stockItems;
  } catch (error) {
    throw error;
  }
}

/**
 * Processes a single transaction and updates stock accordingly
 * Note: Database stores incoming stocks as positive values and outgoing stocks as negative values
 */
function processTransaction(
  transaction: Transaction, 
  getOrCreateStockItem: (productId: string, batchId: string, locationType: string, locationId: string) => StockItem,
  locationFilter: string
) {
  const txType = transaction.transaction_type;
  
  // Determine the location for stock movement
  let stockLocation: string | null = null;
  let stockLocationId: string | null = null;
  
  // Process based on transaction type to determine the correct stock location
  if (txType === 'STOCK_IN_GODOWN') {
    // Stock coming into godown
    stockLocation = 'GODOWN';
    stockLocationId = '';
  }
  else if (txType === 'DISPATCH_TO_MR') {
    // For dispatch, we have two effects:
    // 1. Decrease in godown stock (quantity_strips will be negative in DB)
    if (transaction.location_type_source === 'GODOWN') {
      // Only process if we're interested in godown or all locations
      if (locationFilter === 'ALL' || locationFilter === 'GODOWN') {
        const godownItem = getOrCreateStockItem(
          transaction.product_id,
          transaction.batch_id,
          'GODOWN',
          ''
        );
        // Use absolute value since this represents outflow from godown
        godownItem.current_quantity_strips += transaction.quantity_strips; // DB stores as negative
      }
    }
    
    // 2. Increase in MR stock (quantity_strips will be positive in DB for MR destination)
    if (transaction.location_type_destination === 'MR' && transaction.location_id_destination) {
      // Only process if we're interested in this MR or all MRs or all locations
      const mrId = transaction.location_id_destination;
      if (locationFilter === 'ALL' || 
          locationFilter === 'MR' || 
          (locationFilter.startsWith('MR_') && locationFilter.replace('MR_', '') === mrId)) {
        const mrItem = getOrCreateStockItem(
          transaction.product_id,
          transaction.batch_id,
          'MR',
          mrId
        );
        // Use absolute value since this represents inflow to MR
        mrItem.current_quantity_strips += Math.abs(transaction.quantity_strips);
        mrItem.cost_per_strip = transaction.cost_per_strip_at_transaction;
      }
    }
    
    // Skip the default processing since we've handled both sides
    return;
  }
  else if (txType === 'SALE_DIRECT_GODOWN') {
    // Sale directly from godown
    if (transaction.location_type_source === 'GODOWN') {
      stockLocation = 'GODOWN';
      stockLocationId = '';
    }
  }
  else if (txType === 'SALE_BY_MR') {
    // Sale by MR
    if (transaction.location_type_source === 'MR' && transaction.location_id_source) {
      stockLocation = 'MR';
      stockLocationId = transaction.location_id_source;
    }
  }
  else if (txType.includes('RETURN_TO_GODOWN')) {
    // Return to godown (positive for godown, negative for source if MR)
    if (transaction.location_type_destination === 'GODOWN') {
      // Add to godown
      if (locationFilter === 'ALL' || locationFilter === 'GODOWN') {
        const godownItem = getOrCreateStockItem(
          transaction.product_id,
          transaction.batch_id,
          'GODOWN',
          ''
        );
        // DB stores returns as positive for godown
        godownItem.current_quantity_strips += transaction.quantity_strips;
        godownItem.cost_per_strip = transaction.cost_per_strip_at_transaction;
      }
    }
    
    // Remove from MR if that's the source
    if (transaction.location_type_source === 'MR' && transaction.location_id_source) {
      const mrId = transaction.location_id_source;
      if (locationFilter === 'ALL' || 
          locationFilter === 'MR' || 
          (locationFilter.startsWith('MR_') && locationFilter.replace('MR_', '') === mrId)) {
        const mrItem = getOrCreateStockItem(
          transaction.product_id,
          transaction.batch_id,
          'MR',
          mrId
        );
        // DB stores returns as negative for MR source
        mrItem.current_quantity_strips += transaction.quantity_strips;
      }
    }
    
    // Skip default processing
    return;
  }
  else if (txType.includes('ADJUST_DAMAGE_') || 
           txType.includes('ADJUST_LOSS_') || 
           txType.includes('ADJUST_EXPIRED_')) {
    // Adjustments for damage/loss/expiry
    if (txType.includes('_GODOWN')) {
      stockLocation = 'GODOWN';
      stockLocationId = '';
    } else if (txType.includes('_MR') && transaction.location_id_source) {
      stockLocation = 'MR';
      stockLocationId = transaction.location_id_source;
    }
  }
  else if (txType.includes('OPENING_STOCK_')) {
    // Opening stock
    if (txType.includes('OPENING_STOCK_GODOWN')) {
      stockLocation = 'GODOWN';
      stockLocationId = '';
    } else if (txType.includes('OPENING_STOCK_MR') && transaction.location_id_destination) {
      stockLocation = 'MR';
      stockLocationId = transaction.location_id_destination;
    }
  }
  else if (txType.includes('REPLACEMENT_')) {
    // Handle replacements
    if (txType.includes('REPLACEMENT_FROM_GODOWN')) {
      // Outflow from godown
      if (locationFilter === 'ALL' || locationFilter === 'GODOWN') {
        const godownItem = getOrCreateStockItem(
          transaction.product_id,
          transaction.batch_id,
          'GODOWN',
          ''
        );
        // DB stores replacements as negative for source
        godownItem.current_quantity_strips += transaction.quantity_strips;
      }
    } 
    else if (txType.includes('REPLACEMENT_FROM_MR') && transaction.location_id_source) {
      // Outflow from MR
      const mrId = transaction.location_id_source;
      if (locationFilter === 'ALL' || 
          locationFilter === 'MR' || 
          (locationFilter.startsWith('MR_') && locationFilter.replace('MR_', '') === mrId)) {
        const mrItem = getOrCreateStockItem(
          transaction.product_id,
          transaction.batch_id,
          'MR',
          mrId
        );
        // DB stores replacements as negative for source
        mrItem.current_quantity_strips += transaction.quantity_strips;
      }
    }
    
    // Skip default processing
    return;
  }
  
  // Apply the stock change if we determined a location
  if (stockLocation) {
    // Apply location filter
    if (stockLocation === 'GODOWN' && locationFilter !== 'ALL' && locationFilter !== 'GODOWN') {
      return;
    }
    
    if (stockLocation === 'MR') {
      if (locationFilter !== 'ALL' && locationFilter !== 'MR' && 
          !(locationFilter.startsWith('MR_') && locationFilter.replace('MR_', '') === stockLocationId)) {
        return;
      }
    }
    
    const stockItem = getOrCreateStockItem(
      transaction.product_id,
      transaction.batch_id,
      stockLocation,
      stockLocationId || ''
    );
    
    // Use the quantity_strips directly as DB already stores correct signs
    // Positive for incoming stocks, negative for outgoing stocks
    stockItem.current_quantity_strips += transaction.quantity_strips;
    
    // Update cost per strip for positive transactions (inflows)
    if (transaction.quantity_strips > 0) {
      stockItem.cost_per_strip = transaction.cost_per_strip_at_transaction;
    }
  }
}

/**
 * Calculates summary statistics from stock data
 */
export function calculateStockSummary(stockData: StockItem[]): StockSummary {
  if (!stockData) {
    return { 
      total_products: 0, 
      total_batches: 0, 
      total_value: 0, 
      low_stock_items: 0, 
      expiring_soon_items: 0 
    };
  }

  const uniqueProducts = new Set(stockData.map(item => item.product_id));
  const uniqueBatches = new Set(stockData.map(item => item.batch_id));
  const totalValue = stockData.reduce((sum, item) => sum + item.total_value, 0);

  // Calculate items with low stock
  const lowStockItems = stockData.filter(item => {
    const minLevel = item.location_type === 'GODOWN' 
      ? item.min_stock_level_godown || 0
      : item.min_stock_level_mr || 0;
    return item.current_quantity_strips <= minLevel;
  }).length;

  // Calculate items expiring in next 30 days
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiringSoonItems = stockData.filter(item => {
    const expiryDate = new Date(item.expiry_date);
    return expiryDate <= thirtyDaysFromNow;
  }).length;

  return {
    total_products: uniqueProducts.size,
    total_batches: uniqueBatches.size,
    total_value: totalValue,
    low_stock_items: lowStockItems,
    expiring_soon_items: expiringSoonItems,
  };
}

/**
 * Gets expiry status for a given expiry date
 */
export function getExpiryStatus(expiryDate: string) {
  const expiry = new Date(expiryDate);
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  if (expiry < today) {
    return { status: 'expired', variant: 'destructive' as const };
  } else if (expiry <= thirtyDaysFromNow) {
    return { status: 'expiring-soon', variant: 'secondary' as const };
  } else {
    return { status: 'good', variant: 'default' as const };
  }
}

/**
 * Gets stock status for a given stock item
 */
export function getStockStatus(item: StockItem) {
  const minLevel = item.location_type === 'GODOWN' 
    ? item.min_stock_level_godown || 0
    : item.min_stock_level_mr || 0;

  if (item.current_quantity_strips <= minLevel) {
    return { status: 'low', variant: 'destructive' as const };
  } else if (item.current_quantity_strips <= minLevel * 1.5) {
    return { status: 'medium', variant: 'secondary' as const };
  } else {
    return { status: 'good', variant: 'default' as const };
  }
}