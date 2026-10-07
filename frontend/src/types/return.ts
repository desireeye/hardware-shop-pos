export type ReturnItem = {
  id: string;
  returnId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitRefundPrice: number;
  taxRefundAmount: number;
  refundAmount: number;
  reason: string | null;
  createdAt: string;
};

export type ReturnRecord = {
  id: string;
  returnNumber: string;
  originalOrderId: string;
  orderInvoiceNumber: string | null;
  customerId: string | null;
  customerName: string;
  refundMethod: string;
  refundAmount: number;
  reason: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: ReturnItem[];
};

export type ReturnableItem = {
  id: string;
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  returnableQuantity: number;
  unitPrice: number;
  gstRate: number;
  lineTotal: number;
  refundAmount: number;
  alreadyReturned: number;
};

export type ReturnableItemsResponse = {
  success: boolean;
  orderId: string;
  invoiceNumber: string;
  items: ReturnableItem[];
};

export type ReturnListResponse = {
  success: boolean;
  returns: ReturnRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
