import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../services/api';

const currency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0);

const toDateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type RangeValue = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

function ReportsPage() {
  const [tab, setTab] = useState<'sales' | 'products' | 'customers' | 'returns' | 'purchases' | 'inventory' | 'suppliers'>('sales');
  const [range, setRange] = useState<RangeValue>('today');
  const [fromDate, setFromDate] = useState(toDateInput(new Date()));
  const [toDate, setToDate] = useState(toDateInput(new Date()));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesPages, setSalesPages] = useState(1);
  const [productRows, setProductRows] = useState<any[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [customerRows, setCustomerRows] = useState<any[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [returnRows, setReturnRows] = useState<any[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<any[]>([]);
  const [inventoryRows, setInventoryRows] = useState<any[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [supplierRows, setSupplierRows] = useState<any[]>([]);
  const [supplierTotal, setSupplierTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => ({
    range,
    fromDate: range === 'custom' ? fromDate : undefined,
    toDate: range === 'custom' ? toDate : undefined,
    page,
    pageSize,
  }), [range, fromDate, toDate, page, pageSize]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (tab === 'sales') {
          const response = await api.getSalesReport(query as any);
          setSalesRows(response.rows ?? []);
          setSalesTotal(response.total ?? 0);
          setSalesPages(response.totalPages ?? 1);
        }

        if (tab === 'products') {
          const response = await api.getProductSalesReport(query as any);
          setProductRows(response.rows ?? []);
          setProductTotal(response.total ?? 0);
        }

        if (tab === 'customers') {
          const response = await api.getCustomerReport(query as any);
          setCustomerRows(response.rows ?? []);
          setCustomerTotal(response.total ?? 0);
        }

        if (tab === 'returns') {
          const response = await api.getReturnsReport(query as any);
          setReturnRows(response.rows ?? []);
        }

        if (tab === 'purchases') {
          const response = await api.getPurchaseReport(query as any);
          setPurchaseRows(response.rows ?? []);
        }

        if (tab === 'inventory') {
          const response = await api.getInventoryReport(query as any);
          setInventoryRows(response.rows ?? []);
          setInventoryTotal(response.total ?? 0);
        }

        if (tab === 'suppliers') {
          const response = await api.getSupplierReport({ page, pageSize });
          setSupplierRows(response.rows ?? []);
          setSupplierTotal(response.total ?? 0);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load report data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tab, query]);

  const renderTabs = () => (
    <div className="mb-6 flex flex-wrap gap-2">
      {['sales', 'products', 'customers', 'returns', 'purchases', 'inventory', 'suppliers'].map((tabKey) => (
        <button
          key={tabKey}
          type="button"
          onClick={() => setTab(tabKey as typeof tab)}
          className={`rounded-full px-3 py-2 text-sm font-medium ${tab === tabKey ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          {tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}
        </button>
      ))}
    </div>
  );

  const renderPagination = (totalPages: number) => {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded border px-3 py-1 disabled:opacity-50">Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
      </div>
    );
  };

  const exportReport = async () => {
    const base = '/reports';
    const params = new URLSearchParams();
    if (range === 'custom') {
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
    }
    params.set('range', range);

    const endpointMap: Record<typeof tab, string> = {
      sales: '/sales/export',
      products: '/products/export',
      customers: '/customers/export',
      returns: '/returns/export',
      purchases: '/purchases/export',
      inventory: '/inventory/export',
      suppliers: '/suppliers/export',
    };

    const url = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'}${base}${endpointMap[tab]}?${params.toString()}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Sales and stock insights for your hardware shop</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={range} onChange={(event) => setRange(event.target.value as RangeValue)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
          {range === 'custom' && (
            <>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </>
          )}
          <button type="button" onClick={exportReport} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Export CSV</button>
        </div>
      </div>

      {renderTabs()}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading report...</div> : (
        <>
          {tab === 'sales' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Subtotal</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Tax</th>
                      <th className="px-4 py-3">Grand Total</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesRows.length ? salesRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <Link to={`/orders/${row.id}`} className="text-blue-600 hover:underline">{row.invoiceNumber}</Link>
                        </td>
                        <td className="px-4 py-3">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{row.customer}</td>
                        <td className="px-4 py-3">{currency(row.subtotal)}</td>
                        <td className="px-4 py-3">{currency(row.discount)}</td>
                        <td className="px-4 py-3">{currency(row.tax)}</td>
                        <td className="px-4 py-3 font-semibold">{currency(row.grandTotal)}</td>
                        <td className="px-4 py-3">{row.paymentMethod}</td>
                        <td className="px-4 py-3">{row.createdBy}</td>
                      </tr>
                    )) : <tr><td className="px-4 py-6 text-slate-500" colSpan={9}>No sales found for this range.</td></tr>}
                  </tbody>
                </table>
              </div>
              {renderPagination(salesPages)}
            </div>
          )}

          {tab === 'products' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Quantity Sold</th>
                      <th className="px-4 py-3">Gross Sales</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Tax</th>
                      <th className="px-4 py-3">Net Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.length ? productRows.map((row, index) => (
                      <tr key={`${row.sku}-${index}`} className="border-t border-slate-200">
                        <td className="px-4 py-3">{row.product}</td>
                        <td className="px-4 py-3">{row.sku}</td>
                        <td className="px-4 py-3">{row.quantitySold}</td>
                        <td className="px-4 py-3">{currency(row.grossSales)}</td>
                        <td className="px-4 py-3">{currency(row.discount)}</td>
                        <td className="px-4 py-3">{currency(row.tax)}</td>
                        <td className="px-4 py-3 font-semibold">{currency(row.netSales)}</td>
                      </tr>
                    )) : <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>No product sales data found.</td></tr>}
                  </tbody>
                </table>
              </div>
              {renderPagination(Math.ceil(productTotal / pageSize) || 1)}
            </div>
          )}

          {tab === 'customers' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Orders</th>
                      <th className="px-4 py-3">Total Purchases</th>
                      <th className="px-4 py-3">Last Purchase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerRows.length ? customerRows.map((row, index) => (
                      <tr key={`${row.customer}-${index}`} className="border-t border-slate-200">
                        <td className="px-4 py-3">{row.customer}</td>
                        <td className="px-4 py-3">{row.phone || '—'}</td>
                        <td className="px-4 py-3">{row.numberOfOrders}</td>
                        <td className="px-4 py-3">{currency(row.totalPurchases)}</td>
                        <td className="px-4 py-3">{row.lastPurchase ? new Date(row.lastPurchase).toLocaleDateString() : '—'}</td>
                      </tr>
                    )) : <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>No customer report data found.</td></tr>}
                  </tbody>
                </table>
              </div>
              {renderPagination(Math.ceil(customerTotal / pageSize) || 1)}
            </div>
          )}

          {tab === 'returns' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Return Number</th>
                      <th className="px-4 py-3">Original Invoice</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Returned Items</th>
                      <th className="px-4 py-3">Refund Amount</th>
                      <th className="px-4 py-3">Refund Method</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnRows.length ? returnRows.map((row) => (
                      <tr key={row.returnNumber} className="border-t border-slate-200">
                        <td className="px-4 py-3">{row.returnNumber}</td>
                        <td className="px-4 py-3">{row.originalInvoice}</td>
                        <td className="px-4 py-3">{row.customer}</td>
                        <td className="px-4 py-3">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{row.returnedItems}</td>
                        <td className="px-4 py-3">{currency(row.refundAmount)}</td>
                        <td className="px-4 py-3">{row.refundMethod}</td>
                        <td className="px-4 py-3">{row.status}</td>
                      </tr>
                    )) : <tr><td className="px-4 py-6 text-slate-500" colSpan={8}>No return records found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'purchases' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Purchase Number</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Purchase Total</th>
                      <th className="px-4 py-3">Payment Status</th>
                      <th className="px-4 py-3">Payment Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseRows.length ? purchaseRows.map((row) => (
                      <tr key={row.purchaseNumber} className="border-t border-slate-200">
                        <td className="px-4 py-3">{row.purchaseNumber}</td>
                        <td className="px-4 py-3">{row.supplier}</td>
                        <td className="px-4 py-3">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{currency(row.purchaseTotal)}</td>
                        <td className="px-4 py-3">{row.paymentStatus}</td>
                        <td className="px-4 py-3">{row.paymentMethod}</td>
                      </tr>
                    )) : <tr><td className="px-4 py-6 text-slate-500" colSpan={6}>No purchase records found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'inventory' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Current Stock</th>
                      <th className="px-4 py-3">Minimum Stock</th>
                      <th className="px-4 py-3">Purchase Price</th>
                      <th className="px-4 py-3">Selling Price</th>
                      <th className="px-4 py-3">Estimated Stock Value</th>
                      <th className="px-4 py-3">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryRows.length ? inventoryRows.map((row) => (
                      <tr key={row.sku} className="border-t border-slate-200">
                        <td className="px-4 py-3">{row.product}</td>
                        <td className="px-4 py-3">{row.sku}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.currentStock}</td>
                        <td className="px-4 py-3">{row.minimumStock}</td>
                        <td className="px-4 py-3">{currency(row.purchasePrice)}</td>
                        <td className="px-4 py-3">{currency(row.sellingPrice)}</td>
                        <td className="px-4 py-3">{currency(row.estimatedStockValue)}</td>
                        <td className="px-4 py-3">{row.stockStatus}</td>
                      </tr>
                    )) : <tr><td className="px-4 py-6 text-slate-500" colSpan={9}>No inventory found.</td></tr>}
                  </tbody>
                </table>
              </div>
              {renderPagination(Math.ceil(inventoryTotal / pageSize) || 1)}
            </div>
          )}

          {tab === 'suppliers' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">GSTIN</th>
                      <th className="px-4 py-3">Active Products</th>
                      <th className="px-4 py-3">Total Purchases</th>
                      <th className="px-4 py-3">Total Spend</th>
                      <th className="px-4 py-3">Last Purchase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierRows.length ? supplierRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                        <td className="px-4 py-3">{row.phone ?? '—'}</td>
                        <td className="px-4 py-3">{row.email ?? '—'}</td>
                        <td className="px-4 py-3">{row.gstin ?? '—'}</td>
                        <td className="px-4 py-3">{row.activeProducts}</td>
                        <td className="px-4 py-3">{row.totalPurchases}</td>
                        <td className="px-4 py-3">{currency(row.totalSpend)}</td>
                        <td className="px-4 py-3">{row.lastPurchase ? new Date(row.lastPurchase).toLocaleDateString() : '—'}</td>
                      </tr>
                    )) : <tr><td className="px-4 py-6 text-slate-500" colSpan={8}>No supplier records found.</td></tr>}
                  </tbody>
                </table>
              </div>
              {renderPagination(Math.ceil(supplierTotal / pageSize) || 1)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ReportsPage;
