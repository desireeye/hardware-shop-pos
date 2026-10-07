export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  supplierId?: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  gstRate: number;
  hsnCode?: string | null;
  currentStock: number;
  minimumStock: number;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; isActive: boolean } | null;
  brand?: { id: string; name: string; isActive: boolean } | null;
  supplier?: { id: string; name: string; phone?: string | null } | null;
};

export type ProductListResponse = {
  success: boolean;
  products: Product[];
  total: number;
  page: number;
  limit: number;
};

export type ProductResponse = {
  success: boolean;
  message: string;
  product: Product;
};

export type StockTransaction = {
  id: string;
  productId: string;
  type: 'STOCK_IN' | 'ADJUSTMENT' | 'DAMAGED' | 'LOST';
  quantity: number;
  previousStock: number | null;
  newStock: number | null;
  reason: string | null;
  unitCost: number | null;
  notes: string | null;
  userId: string | null;
  createdAt: string;
};
