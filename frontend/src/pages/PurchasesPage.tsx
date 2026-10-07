import { type FormEvent, useEffect, useState } from 'react';

import { api } from '../services/api';
import type { Product } from '../types/product';
import type { Purchase, Supplier } from '../types/supplier';

const emptyItem = { productId: '', quantity: 1, unitCost: 0, taxRate: 0 };

function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([emptyItem]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      const [supplierResponse, productResponse, purchaseResponse] = await Promise.all([
        api.getSuppliers(),
        api.getProducts(),
        api.getPurchases(),
      ]);
      setSuppliers(supplierResponse.suppliers);
      setProducts(productResponse.products);
      setPurchases(purchaseResponse.purchases);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load purchase data.');
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateItem = (index: number, field: keyof typeof emptyItem, value: string | number) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.createPurchase({
        supplierId,
        invoiceNumber,
        notes,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          taxRate: Number(item.taxRate),
        })),
      });
      setSuccess('Purchase saved and stock updated.');
      setSupplierId('');
      setInvoiceNumber('');
      setNotes('');
      setItems([emptyItem]);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save purchase.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Stock Purchases</h2>
        <p className="mt-1 text-sm text-slate-600">Record incoming inventory and update product stock instantly.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">New Purchase</h3>
          {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" required>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
            <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Invoice number" />
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={`${index}-${item.productId}`} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.3fr_0.8fr_0.9fr_0.8fr_auto]">
                <select value={item.productId} onChange={(event) => updateItem(index, 'productId', event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2" required>
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
                  ))}
                </select>
                <input type="number" min={1} value={item.quantity} onChange={(event) => updateItem(index, 'quantity', Number(event.target.value))} className="rounded-xl border border-slate-300 bg-white px-3 py-2" required />
                <input type="number" min={0} step="0.01" value={item.unitCost} onChange={(event) => updateItem(index, 'unitCost', Number(event.target.value))} className="rounded-xl border border-slate-300 bg-white px-3 py-2" required />
                <input type="number" min={0} max={100} step="0.01" value={item.taxRate} onChange={(event) => updateItem(index, 'taxRate', Number(event.target.value))} className="rounded-xl border border-slate-300 bg-white px-3 py-2" />
                <button type="button" onClick={() => removeItem(index)} className="rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-sm font-semibold text-red-700">Remove</button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => setItems((current) => [...current, { ...emptyItem }])} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Add item</button>
          </div>

          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-4 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Notes" />

          <button type="submit" className="mt-5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Record Purchase</button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Recent Purchases</h3>
          <div className="mt-4 space-y-3">
            {purchases.length === 0 ? (
              <p className="text-sm text-slate-500">No purchase records yet.</p>
            ) : (
              purchases.slice(0, 6).map((purchase) => (
                <div key={purchase.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{purchase.purchaseNumber}</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{purchase.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{purchase.supplierName ?? 'Supplier'} • ₹{purchase.totalAmount.toLocaleString('en-IN')}</p>
                  <p className="mt-1 text-xs text-slate-500">{purchase.items.length} item(s)</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PurchasesPage;
