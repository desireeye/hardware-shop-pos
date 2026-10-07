import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../services/api';
import type { OrderSummary } from '../types/order';

const statusOptions = ['ALL', 'PENDING', 'COMPLETED', 'CANCELLED', 'CONFIRMED', 'PROCESSING', 'DRAFT'];
const paymentOptions = ['ALL', 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT'];

function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        const response = await api.getOrders({
          page,
          pageSize,
          search,
          fromDate,
          toDate,
          status,
          paymentMethod,
        });

        setOrders(response.orders);
        setTotal(response.total);
        setError('');
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load order history.');
      } finally {
        setLoading(false);
      }
    };

    void loadOrders();
  }, [page, pageSize, search, fromDate, toDate, status, paymentMethod]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleClearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setStatus('ALL');
    setPaymentMethod('ALL');
    setPage(1);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      setPage(1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sales History</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Orders</h2>
          </div>
          <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            {total} sales
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[2fr,1fr,1fr,1fr,1fr]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500"
            placeholder="Invoice, customer, phone, product"
          />

          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500"
          />

          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option === 'ALL' ? 'All Status' : option}</option>
            ))}
          </select>

          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500"
          >
            {paymentOptions.map((option) => (
              <option key={option} value={option}>{option === 'ALL' ? 'All Payment' : option}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading sales history...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Invoice</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Payment</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Created By</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                      No orders match your search.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="align-top">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        <Link to={`/orders/${order.id}`} className="hover:text-brand-600">
                          {order.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {new Date(order.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="font-medium text-slate-900">{order.customerName}</div>
                        {order.customerPhone ? <div className="text-xs text-slate-500">{order.customerPhone}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">₹{(order.grandTotal ?? 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{order.paymentMethod ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{order.cashierName}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <Link to={`/orders/${order.id}`} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400">
                            View
                          </Link>
                          <a href={`/invoices/${order.id}`} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
                            Invoice
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page === 1 || loading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>

        <button
          type="button"
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={page >= totalPages || loading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default OrdersPage;
