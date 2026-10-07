import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../services/api';
import type { OrderDetail } from '../types/order';

function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) {
        setError('No order id provided.');
        setLoading(false);
        return;
      }

      try {
        const response = await api.getOrderById(id);
        setOrder(response.order);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load order details.');
      } finally {
        setLoading(false);
      }
    };

    void loadOrder();
  }, [id]);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading order details...</div>;
  }

  if (error || !order) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error || 'Order not found.'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Back to Orders
        </button>

        <div className="flex flex-wrap gap-3">
          {order.orderStatus === 'COMPLETED' ? (
            <button
              type="button"
              onClick={() => navigate(`/orders/${order.id}/return`)}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Start Return
            </button>
          ) : null}
          <a href={`/invoices/${order.id}`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            View Invoice
          </a>
          <button
            type="button"
            onClick={() => window.open(`/invoices/${order.id}`, '_blank', 'noopener,noreferrer')}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Print Invoice
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Order Information</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{order.invoiceNumber}</h2>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            {order.orderStatus}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Date & Time</p>
            <p className="mt-2 text-sm text-slate-800">
              {new Date(order.createdAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Created By</p>
            <p className="mt-2 text-sm text-slate-800">{order.cashierName}</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Payment</p>
            <p className="mt-2 text-sm text-slate-800">{order.paymentMethod ?? '—'} • {order.paymentStatus}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Customer</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p><span className="font-semibold text-slate-900">Name:</span> {order.customer.name}</p>
            <p><span className="font-semibold text-slate-900">Phone:</span> {order.customer.phone ?? '—'}</p>
            <p><span className="font-semibold text-slate-900">Address:</span> {order.customer.address ?? '—'}</p>
            <p><span className="font-semibold text-slate-900">Email:</span> {order.customer.email ?? '—'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Payment Summary</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p><span className="font-semibold text-slate-900">Method:</span> {order.payment?.method ?? '—'}</p>
            <p><span className="font-semibold text-slate-900">Amount:</span> ₹{(order.payment?.amount ?? 0).toLocaleString('en-IN')}</p>
            <p><span className="font-semibold text-slate-900">Status:</span> {order.payment?.status ?? '—'}</p>
            <p><span className="font-semibold text-slate-900">Reference:</span> {order.payment?.referenceNo ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Items</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Product</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">SKU</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Qty</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Unit Rate</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Discount</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">GST</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Tax</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-slate-800">{item.productNameSnapshot}</td>
                  <td className="px-3 py-2 text-slate-700">{item.skuSnapshot}</td>
                  <td className="px-3 py-2 text-slate-700">{item.quantity}</td>
                  <td className="px-3 py-2 text-slate-700">₹{item.actualUnitPrice.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-slate-700">₹{item.discount.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-slate-700">{item.gstRate}%</td>
                  <td className="px-3 py-2 text-slate-700">₹{item.taxAmount.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">₹{item.lineTotal.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Order Totals</h3>
        <div className="mt-4 ml-auto max-w-md space-y-2 text-sm text-slate-700">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-₹{order.discount.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>Taxable Amount</span><span>₹{order.taxableAmount.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>CGST</span><span>₹{order.cgst.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>₹{order.sgst.toLocaleString('en-IN')}</span></div>
          {order.igst > 0 ? <div className="flex justify-between"><span>IGST</span><span>₹{order.igst.toLocaleString('en-IN')}</span></div> : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Grand Total</span><span>₹{order.grandTotal.toLocaleString('en-IN')}</span></div>
        </div>
      </div>
    </div>
  );
}

export default OrderDetailPage;
