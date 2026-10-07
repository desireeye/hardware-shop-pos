export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  totalOrders?: number;
  totalPurchases?: number;
  lastPurchaseAt?: string | null;
};

export type CustomerPurchaseHistoryItem = {
  id: string;
  invoiceNumber: string;
  date: string;
  total: number;
  paymentStatus: string;
  orderStatus: string;
  paymentMethod: string | null;
};
