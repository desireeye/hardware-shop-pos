import { useEffect, useState } from 'react';

import { api } from '../services/api';

const currency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0);

function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await api.getDashboardSummary({ range: 'today' });
        setSummary(response);
      } catch (err: any) {
        setError(err.message || 'Unable to load dashboard summary.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading dashboard...</div>;
  }

  if (error || !summary) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || 'Dashboard data unavailable.'}</div>;
  }

  const metrics = [
    { label: 'Sales', value: currency(summary.summary.sales), change: `${summary.range?.label ?? 'Today'}` },
    { label: 'Orders', value: String(summary.summary.orders), change: 'Completed' },
    { label: 'Low Stock', value: String(summary.summary.lowStockCount), change: `${summary.summary.outOfStockCount} out of stock` },
    { label: 'Net Sales', value: currency(summary.summary.netSales), change: `Returns ${currency(summary.summary.returns)}` },
  ];

  const maxTrendValue = Math.max(...(summary.trend?.values ?? [1]), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <h3 className="text-2xl font-bold text-slate-900">{metric.value}</h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Sales Trend</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{summary.range?.label ?? 'Current range'}</span>
          </div>

          <div className="mt-6 space-y-4">
            {(summary.trend?.labels ?? []).map((label: string, index: number) => {
              const value = summary.trend?.values?.[index] ?? 0;
              const height = (value / maxTrendValue) * 100;
              return (
                <div key={`${label}-${index}`} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-medium text-slate-500">{new Date(label).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${height}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs font-medium text-slate-500">{currency(value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Stock Watch</h3>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {summary.lowStockItems?.length ? summary.lowStockItems.slice(0, 4).map((item: any) => (
              <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">{item.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.currentStock} left / min {item.minimumStock}</div>
              </div>
            )) : <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">All products are within stock targets.</div>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent Sales</h3>
          <div className="mt-4 space-y-3">
            {summary.recentSales?.length ? summary.recentSales.map((sale: any) => (
              <div key={sale.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div>
                  <div className="font-medium text-slate-800">{sale.invoiceNumber}</div>
                  <div className="text-xs text-slate-500">{sale.customer} • {new Date(sale.createdAt).toLocaleDateString('en-IN')}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-800">{currency(sale.total)}</div>
                  <div className="text-xs text-slate-500">{sale.paymentMethod}</div>
                </div>
              </div>
            )) : <div className="text-sm text-slate-500">No recent sales in the selected range.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent Purchases</h3>
          <div className="mt-4 space-y-3">
            {summary.recentPurchases?.length ? summary.recentPurchases.map((purchase: any) => (
              <div key={purchase.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div>
                  <div className="font-medium text-slate-800">{purchase.purchaseNumber}</div>
                  <div className="text-xs text-slate-500">{purchase.supplier} • {new Date(purchase.createdAt).toLocaleDateString('en-IN')}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-800">{currency(purchase.total)}</div>
                  <div className="text-xs text-slate-500">{purchase.status}</div>
                </div>
              </div>
            )) : <div className="text-sm text-slate-500">No recent purchases in the selected range.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
