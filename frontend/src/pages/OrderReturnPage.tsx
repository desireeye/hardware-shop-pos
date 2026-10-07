import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../services/api';
import type { ReturnableItem } from '../types/return';

function OrderReturnPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<ReturnableItem[]>([]);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT'>('CASH');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadReturnableItems = async () => {
      if (!id) {
        setError('No order id provided.');
        setLoading(false);
        return;
      }

      try {
        const response = await api.getReturnableItems(id);
        setItems(response.items);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load returnable items.');
      } finally {
        setLoading(false);
      }
    };

    void loadReturnableItems();
  }, [id]);

  const totalRefundAmount = useMemo(
    () => items.reduce((sum, item) => {
      if (!selectedIds.includes(item.id)) return sum;
      const quantity = selectedQuantities[item.id] ?? 0;
      return sum + (item.unitPrice * quantity) * (1 + (item.gstRate / 100));
    }, 0),
    [items, selectedIds, selectedQuantities],
  );

  const toggleItem = (item: ReturnableItem) => {
    setSelectedIds((current) => {
      if (current.includes(item.id)) {
        const next = current.filter((entry) => entry !== item.id);
        setSelectedQuantities((quantities) => ({ ...quantities, [item.id]: 0 }));
        return next;
      }

      setSelectedQuantities((quantities) => ({ ...quantities, [item.id]: item.returnableQuantity }));
      return [...current, item.id];
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;

    const nextQuantity = Math.min(Math.max(quantity, 0), item.returnableQuantity);
    setSelectedQuantities((current) => ({ ...current, [itemId]: nextQuantity }));

    if (nextQuantity > 0 && !selectedIds.includes(itemId)) {
      setSelectedIds((current) => [...current, itemId]);
    }
    if (nextQuantity <= 0 && selectedIds.includes(itemId)) {
      setSelectedIds((current) => current.filter((entry) => entry !== itemId));
    }
  };

  const handleSubmit = async () => {
    if (!id) {
      setError('Order id is missing.');
      return;
    }

    const selectedItems = items.filter((item) => selectedIds.includes(item.id) && (selectedQuantities[item.id] ?? 0) > 0);

    if (selectedItems.length === 0) {
      setError('Select at least one item to return.');
      return;
    }

    const invalidItem = selectedItems.find((item) => (selectedQuantities[item.id] ?? 0) > item.returnableQuantity);
    if (invalidItem) {
      setError(`Return quantity for ${invalidItem.productName} exceeds the available quantity.`);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.createReturn({
        orderId: id,
        refundMethod,
        reason,
        idempotencyKey: `return:${id}:${Date.now()}`,
        items: selectedItems.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: selectedQuantities[item.id] ?? 0,
          reason: reason || `Return for ${item.productName}`,
        })),
      });

      setSuccess(response.message);
      setTimeout(() => {
        navigate(`/orders/${id}`);
      }, 800);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to process the return.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading returnable items...</div>;
  }

  if (error && items.length === 0) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Return Order</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Create Return</h2>
          </div>
          <button type="button" onClick={() => navigate(`/orders/${id}`)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Back to Order
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {items.length === 0 ? (
            <p className="text-slate-600">No returnable items found for this order.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItem(item)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{item.productName}</p>
                      <p className="text-xs text-slate-500">{item.sku}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span>Available: {item.returnableQuantity}</span>
                    <input
                      type="number"
                      min={0}
                      max={item.returnableQuantity}
                      value={selectedQuantities[item.id] ?? 0}
                      onChange={(event) => updateQuantity(item.id, Number(event.target.value))}
                      className="w-20 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-center"
                      disabled={!selectedIds.includes(item.id)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Refund Method
            <select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as typeof refundMethod)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CREDIT">Credit</option>
            </select>
          </label>

          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Estimated Refund</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">₹{totalRefundAmount.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
          Reason
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" placeholder="Why is this item being returned?" />
        </label>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => navigate(`/orders/${id}`)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Processing...' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrderReturnPage;
