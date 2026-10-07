import type { AuthUser, LoginResponse } from '../types/auth';
import type { Customer, CustomerPurchaseHistoryItem } from '../types/customer';
import type { InvoiceResponse, OrderDetailResponse, OrderSummary } from '../types/order';
import type { Product, ProductListResponse, ProductResponse } from '../types/product';
import type { ReturnableItemsResponse, ReturnListResponse, ReturnRecord } from '../types/return';
import type { Purchase, PurchaseListResponse, Supplier, SupplierListResponse } from '../types/supplier';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

type ApiOptions = RequestInit & {
  body?: unknown;
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  const hasBody = options.body !== undefined;

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message ?? 'Request failed.';
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  login: async (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: async () => request<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' }),

  getMe: async () => request<{ success: boolean; user: AuthUser }>('/auth/me'),

  getUsers: async () => request<{ success: boolean; users: AuthUser[] }>('/users'),

  getCustomers: async (params: { page?: number; pageSize?: number; search?: string } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return request<{ success: boolean; customers: Customer[]; total: number; page: number; pageSize: number; totalPages: number }>(`/customers${queryString ? `?${queryString}` : ''}`);
  },

  createCustomer: async (payload: { name: string; phone?: string; address?: string }) =>
    request<{ success: boolean; message: string; customer: Customer }>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCustomer: async (id: string, payload: { name?: string; phone?: string; address?: string }) =>
    request<{ success: boolean; message: string; customer: Customer }>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getCustomerById: async (id: string) =>
    request<{ success: boolean; customer: Customer & { totalOrders: number; totalPurchases: number; lastPurchaseAt: string | null }; purchaseHistory: CustomerPurchaseHistoryItem[] }>(`/customers/${id}`),

  getCustomerOrders: async (id: string, params: { page?: number; pageSize?: number; fromDate?: string; toDate?: string } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; orders: CustomerPurchaseHistoryItem[]; total: number; page: number; pageSize: number; totalPages: number }>(`/customers/${id}/orders${queryString ? `?${queryString}` : ''}`);
  },

  createStaff: async (payload: { name: string; email: string; password: string; confirmPassword: string; role: 'STAFF' }) =>
    request<{ success: boolean; message: string; user: AuthUser }>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  activateUser: async (id: string) =>
    request<{ success: boolean; message: string; user: AuthUser }>(`/users/${id}/activate`, {
      method: 'PATCH',
    }),

  deactivateUser: async (id: string) =>
    request<{ success: boolean; message: string; user: AuthUser }>(`/users/${id}/deactivate`, {
      method: 'PATCH',
    }),

  resetPassword: async (id: string) =>
    request<{ success: boolean; message: string; temporaryPassword: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
    }),

  changePassword: async (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProducts: async () => request<ProductListResponse>('/products'),

  createProduct: async (payload: Partial<Product> & { name: string; sku: string; unit: string; purchasePrice: number; sellingPrice: number; mrp: number; gstRate: number; currentStock: number; minimumStock: number }) =>
    request<ProductResponse>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateStock: async (payload: { sku: string; type: 'STOCK_IN' | 'ADJUSTMENT' | 'DAMAGED' | 'LOST'; quantity: number; reason: string; unitCost?: number }) =>
    request<{ success: boolean; message: string; product: Product; transaction: unknown }>('/products/stock', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOrders: async (params: { page?: number; pageSize?: number; search?: string; customerId?: string; fromDate?: string; toDate?: string; paymentMethod?: string; status?: string } = {}) => {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return request<{ success: boolean; orders: OrderSummary[]; total: number; page: number; pageSize: number; totalPages: number }>(`/orders${queryString ? `?${queryString}` : ''}`);
  },

  getOrderById: async (id: string) => request<OrderDetailResponse>(`/orders/${id}`),

  getInvoice: async (id: string) => request<InvoiceResponse>(`/orders/${id}/invoice`),

  getReturnableItems: async (orderId: string) => request<ReturnableItemsResponse>(`/orders/${orderId}/returnable-items`),

  getSuppliers: async () => request<SupplierListResponse>('/suppliers'),

  getSupplierById: async (id: string) => request<{ success: boolean; supplier: Supplier; purchases: Purchase[] }>(`/suppliers/${id}`),

  createSupplier: async (payload: { name: string; phone?: string; email?: string; address?: string; gstin?: string }) =>
    request<{ success: boolean; message: string; supplier: Supplier }>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPurchases: async () => request<PurchaseListResponse>('/purchases'),

  getPurchaseById: async (id: string) => request<{ success: boolean; purchase: Purchase }>(`/purchases/${id}`),

  createPurchase: async (payload: {
    supplierId: string;
    invoiceNumber?: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number; unitCost: number; taxRate?: number }>;
  }) => request<{ success: boolean; message: string; purchase: Purchase }>('/purchases', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getSettings: async () => request<{ success: boolean; settings: { shopName: string; shopAddress: string; shopPhone: string; shopEmail: string; shopGstin: string; invoiceFooter: string; returnPolicy: string; defaultPageSize: number; currencySymbol: string } }>('/settings'),

  updateSettings: async (payload: { shopName?: string; shopAddress?: string; shopPhone?: string; shopEmail?: string; shopGstin?: string; invoiceFooter?: string; returnPolicy?: string; defaultPageSize?: number; currencySymbol?: string }) =>
    request<{ success: boolean; message: string; settings: { shopName: string; shopAddress: string; shopPhone: string; shopEmail: string; shopGstin: string; invoiceFooter: string; returnPolicy: string; defaultPageSize: number; currencySymbol: string } }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getDashboardSummary: async (params: { range?: string; fromDate?: string; toDate?: string } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; summary: { sales: number; orders: number; returns: number; netSales: number; lowStockCount: number; outOfStockCount: number; estimatedStockValue: number; totalActiveProducts: number; totalStockUnits: number }; lowStockItems: Array<{ id: string; name: string; sku: string; currentStock: number; minimumStock: number; status: string }>; outOfStockItems: Array<{ id: string; name: string; sku: string; currentStock: number; minimumStock: number; status: string }>; recentSales: Array<{ id: string; invoiceNumber: string; customer: string; total: number; paymentMethod: string; createdAt: string; status: string; itemCount: number }>; recentPurchases: Array<{ id: string; purchaseNumber: string; supplier: string; total: number; status: string; createdAt: string; itemCount: number }>; returns: { count: number; totalRefundAmount: number; returnedQuantity: number }; trend: { labels: string[]; values: number[] }; range: { value: string; label: string } }>(`/dashboard/summary${queryString ? `?${queryString}` : ''}`);
  },

  getReturns: async (params: { page?: number; pageSize?: number; search?: string; status?: string; fromDate?: string; toDate?: string } = {}) => {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return request<ReturnListResponse>(`/returns${queryString ? `?${queryString}` : ''}`);
  },

  getSalesReport: async (params: { range?: string; fromDate?: string; toDate?: string; paymentMethod?: string; customer?: string; invoice?: string; page?: number; pageSize?: number } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; rows: Array<{ id: string; invoiceNumber: string; date: string; customer: string; subtotal: number; discount: number; tax: number; grandTotal: number; paymentMethod: string; createdBy: string }>; total: number; page: number; pageSize: number; totalPages: number }>(`/reports/sales${queryString ? `?${queryString}` : ''}`);
  },

  getProductSalesReport: async (params: { range?: string; fromDate?: string; toDate?: string; page?: number; pageSize?: number } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; rows: Array<{ product: string; sku: string; quantitySold: number; grossSales: number; discount: number; tax: number; netSales: number }>; total: number; page: number; pageSize: number; totalPages: number }>(`/reports/products${queryString ? `?${queryString}` : ''}`);
  },

  getCustomerReport: async (params: { range?: string; fromDate?: string; toDate?: string; page?: number; pageSize?: number } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; rows: Array<{ customer: string; phone: string | null; numberOfOrders: number; totalPurchases: number; lastPurchase: string | null }>; total: number; page: number; pageSize: number; totalPages: number }>(`/reports/customers${queryString ? `?${queryString}` : ''}`);
  },

  getReturnsReport: async (params: { range?: string; fromDate?: string; toDate?: string; search?: string; page?: number; pageSize?: number } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; rows: Array<{ returnNumber: string; originalInvoice: string; customer: string; date: string; returnedItems: number; refundAmount: number; refundMethod: string; status: string }>; total: number; page: number; pageSize: number; totalPages: number }>(`/reports/returns${queryString ? `?${queryString}` : ''}`);
  },

  getPurchaseReport: async (params: { range?: string; fromDate?: string; toDate?: string; supplierId?: string; status?: string; search?: string; page?: number; pageSize?: number } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; rows: Array<{ purchaseNumber: string; supplier: string; date: string; purchaseTotal: number; paymentStatus: string; paymentMethod: string }>; total: number; page: number; pageSize: number; totalPages: number }>(`/reports/purchases${queryString ? `?${queryString}` : ''}`);
  },

  getSupplierReport: async (params: { search?: string; page?: number; pageSize?: number } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; rows: Array<{ id: string; name: string; phone: string | null; email: string | null; gstin: string | null; activeProducts: number; totalPurchases: number; totalSpend: number; lastPurchase: string | null }>; total: number; page: number; pageSize: number; totalPages: number }>(`/reports/suppliers${queryString ? `?${queryString}` : ''}`);
  },

  getInventoryReport: async (params: { category?: string; brand?: string; supplier?: string; stockStatus?: string; page?: number; pageSize?: number } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return request<{ success: boolean; rows: Array<{ product: string; sku: string; category: string; currentStock: number; minimumStock: number; purchasePrice: number; sellingPrice: number; estimatedStockValue: number; stockStatus: string }>; total: number; page: number; pageSize: number; totalPages: number }>(`/reports/inventory${queryString ? `?${queryString}` : ''}`);
  },

  createReturn: async (payload: {
    orderId: string;
    refundMethod: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';
    reason?: string;
    idempotencyKey?: string;
    items: Array<{ orderItemId: string; quantity: number; reason?: string }>;
  }) => request<{ success: boolean; message: string; return: ReturnRecord }>(`/returns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  checkoutSale: async (payload: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';
    amountPaid: number;
    discountAmount?: number;
    notes?: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number; discountAmount?: number }>;
  }) =>
    request<{ success: boolean; message: string; order: { id: string; invoiceNumber: string; grandTotal: number; paymentStatus: string; orderStatus: string; items: Array<{ id: string; productId: string; quantity: number; lineTotal: number }> }; payment: { id: string; paymentMethod: string; amount: number; status: string } | null; stockUpdated: boolean }>('/sales/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
