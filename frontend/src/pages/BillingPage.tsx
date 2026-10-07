import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../services/api';
import type { OrderSummary } from '../types/order';

function BillingPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await api.getOrders({
        page,
        pageSize,
        search,
        fromDate,
        toDate,
      });

      setOrders(response.orders);
      setTotal(response.total);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load billing history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [page, pageSize]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      void loadOrders();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Invoice History</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Billing & Orders</h2>
          </div>
          <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            {total} records
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" placeholder="Invoice, customer, phone" />
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
          <button onClick={() => void loadOrders()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            Apply Filters
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading invoice history...</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Invoice No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Items</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Payment</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Cashier</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    No orders found for the selected period.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{order.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{new Date(order.createdAt).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{order.customerName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{order.itemCount}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">₹{order.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{order.paymentMethod ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{order.cashierName}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <Link to={`/invoices/${order.id}`} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                          View
                        </Link>
                        <a href={`/invoices/${order.id}`} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white">
                          Print
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
          Previous
        </button>
        <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
        <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
          Next
        </button>
      </div>
    </div>
  );
}

export default BillingPage;
