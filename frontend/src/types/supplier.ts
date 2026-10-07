export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseItemSummary = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  totalAmount: number;
};

export type Purchase = {
  id: string;
  supplierId: string;
  supplierName: string | null;
  purchaseNumber: string;
  invoiceNumber: string | null;
  totalAmount: number;
  paidAmount: number;
  status: string;
  notes: string | null;
  createdAt: string;
  items: PurchaseItemSummary[];
};

export type SupplierListResponse = {
  success: boolean;
  suppliers: Supplier[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PurchaseListResponse = {
  success: boolean;
  purchases: Purchase[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
