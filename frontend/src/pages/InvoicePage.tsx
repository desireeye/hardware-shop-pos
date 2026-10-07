import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../services/api';
import type { InvoiceResponse } from '../types/order';

function InvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceResponse['invoice'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInvoice = async () => {
      if (!id) return;

      try {
        const response = await api.getInvoice(id);
        setInvoice(response.invoice);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load invoice.');
      } finally {
        setLoading(false);
      }
    };

    void loadInvoice();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading invoice...</div>;
  }

  if (error || !invoice) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error || 'Invoice not found.'}</div>;
  }

  return (
    <div className="space-y-6 print:space-y-0">
      <style>{`
        @media print {
          body { background: white; }
          header, aside, nav, .no-print { display: none !important; }
          main { padding: 0 !important; }
          .invoice-shell { box-shadow: none !important; border: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3">
        <button onClick={() => navigate('/billing')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          Back
        </button>
        <button onClick={handlePrint} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
          Print Invoice
        </button>
      </div>

      <div className="invoice-shell rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:bg-white print:p-0 print:shadow-none print:border-0">
        <div className="border-b border-slate-200 pb-5">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900">{invoice.shop.name}</h1>
            <p className="mt-2 text-sm text-slate-600">{invoice.shop.address}</p>
            <p className="text-sm text-slate-600">Phone: {invoice.shop.phone}</p>
            <p className="text-sm text-slate-600">{invoice.shop.gstin}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-5 md:flex-row md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Invoice</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{invoice.invoiceNumber}</p>
          </div>
          <div className="text-sm text-slate-700">
            <p><span className="font-semibold">Date:</span> {new Date(invoice.createdAt).toLocaleDateString('en-GB')}</p>
            <p><span className="font-semibold">Time:</span> {new Date(invoice.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
            <p><span className="font-semibold">Cashier:</span> {invoice.cashier.name}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Customer</p>
          <div className="mt-2 text-sm text-slate-700">
            <p>{invoice.customer.name}</p>
            {invoice.customer.phone ? <p>{invoice.customer.phone}</p> : null}
            {invoice.customer.address ? <p>{invoice.customer.address}</p> : null}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">S.No.</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Item</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">SKU</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Qty</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Rate</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Discount</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">GST</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 text-slate-700">{item.serialNo}</td>
                  <td className="px-3 py-3 text-slate-700">{item.productName}</td>
                  <td className="px-3 py-3 text-slate-700">{item.sku}</td>
                  <td className="px-3 py-3 text-slate-700">{item.quantity}</td>
                  <td className="px-3 py-3 text-slate-700">₹{item.rate.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-slate-700">₹{item.discount.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-slate-700">{item.gstRate}%</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">₹{item.lineTotal.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 ml-auto max-w-md space-y-2 text-sm text-slate-700">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{invoice.subtotal.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-₹{invoice.discount.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>Taxable Amount</span><span>₹{invoice.taxableAmount.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>CGST</span><span>₹{invoice.cgst.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>₹{invoice.sgst.toLocaleString('en-IN')}</span></div>
          {invoice.igst > 0 ? <div className="flex justify-between"><span>IGST</span><span>₹{invoice.igst.toLocaleString('en-IN')}</span></div> : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Grand Total</span><span>₹{invoice.grandTotal.toLocaleString('en-IN')}</span></div>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-500">Amount in Words</p>
          <p className="mt-2 text-base font-medium text-slate-900">{invoice.amountInWords}</p>
        </div>

        <div className="mt-6 text-sm text-slate-700">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-500">Payment</p>
          <p className="mt-2">{invoice.payment.method} — {invoice.payment.status} — ₹{invoice.payment.amount.toLocaleString('en-IN')}</p>
          {invoice.payment.referenceNo ? <p>Reference No: {invoice.payment.referenceNo}</p> : null}
        </div>

        <div className="mt-8 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
          <p>{invoice.shop.footer}</p>
          <p className="mt-2">{invoice.shop.returnPolicy}</p>
        </div>
      </div>
    </div>
  );
}

export default InvoicePage;
