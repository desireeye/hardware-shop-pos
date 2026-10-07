export type OrderSummary = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  orderStatus: string;
  paymentStatus: string;
  grandTotal: number;
  itemCount: number;
  cashierName: string;
  paymentMethod: string | null;
};

export type OrderItemDetail = {
  id: string;
  orderId: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  originalUnitPrice: number;
  actualUnitPrice: number;
  discount: number;
  gstRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  lineTotal: number;
  createdAt: string;
};

export type OrderDetail = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  orderStatus: string;
  paymentStatus: string;
  grandTotal: number;
  itemCount: number;
  cashierName: string;
  paymentMethod: string | null;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  customer: {
    id: string | null;
    name: string;
    phone: string | null;
    address: string | null;
    email: string | null;
  };
  items: OrderItemDetail[];
  payment: {
    id: string;
    method: string;
    amount: number;
    status: string;
    referenceNo: string | null;
  } | null;
  cashier: {
    id: string | null;
    name: string;
  };
};

export type OrderDetailResponse = {
  success: boolean;
  order: OrderDetail;
};

export type InvoiceItem = {
  serialNo: number;
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  rate: number;
  discount: number;
  gstRate: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
};

export type InvoiceResponse = {
  success: boolean;
  invoice: {
    id: string;
    invoiceNumber: string;
    orderStatus: string;
    paymentStatus: string;
    createdAt: string;
    customer: {
      name: string;
      phone: string | null;
      address: string | null;
      email: string | null;
    };
    cashier: { id: string | null; name: string };
    payment: {
      method: string;
      amount: number;
      status: string;
      referenceNo: string | null;
    };
    items: InvoiceItem[];
    subtotal: number;
    discount: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    grandTotal: number;
    amountInWords: string;
    shop: {
      name: string;
      address: string;
      phone: string;
      email: string;
      gstin: string;
      footer: string;
      returnPolicy: string;
    };
  };
};
