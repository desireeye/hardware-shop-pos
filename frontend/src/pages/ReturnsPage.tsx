import { useEffect, useState } from 'react';

import { api } from '../services/api';
import type { ReturnRecord } from '../types/return';

function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadReturns = async () => {
      try {
        const response = await api.getReturns({ page: 1, pageSize: 20 });
        setReturns(response.returns);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load returns.');
      } finally {
        setLoading(false);
      }
    };

    void loadReturns();
  }, []);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading returns...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Returns & Refunds</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Return History</h2>
          </div>
          <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            {returns.length} entries
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {returns.length === 0 ? (
          <p className="text-slate-600">No return records found yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Return</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Order</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Refund</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Method</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {returns.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{entry.returnNumber}</td>
                    <td className="px-3 py-2 text-slate-700">{entry.orderInvoiceNumber ?? entry.originalOrderId}</td>
                    <td className="px-3 py-2 text-slate-700">{entry.customerName}</td>
                    <td className="px-3 py-2 text-slate-700">₹{(entry.refundAmount ?? 0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-slate-700">{entry.refundMethod}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReturnsPage;
