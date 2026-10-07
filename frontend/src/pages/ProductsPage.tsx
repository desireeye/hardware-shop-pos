import { useEffect, useState } from 'react';

import { api } from '../services/api';
import type { Product } from '../types/product';

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  unit: 'PCS',
  purchasePrice: '0',
  sellingPrice: '0',
  mrp: '0',
  gstRate: '18',
  hsnCode: '',
  currentStock: '0',
  minimumStock: '0',
  description: '',
};

const stockEmptyForm = {
  sku: '',
  type: 'STOCK_IN' as 'STOCK_IN' | 'ADJUSTMENT' | 'DAMAGED' | 'LOST',
  quantity: '0',
  reason: '',
  unitCost: '',
};

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [stockForm, setStockForm] = useState(stockEmptyForm);

  const loadProducts = async () => {
    try {
      const response = await api.getProducts();
      setProducts(response.products);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await api.createProduct({
        ...form,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        mrp: Number(form.mrp),
        gstRate: Number(form.gstRate),
        currentStock: Number(form.currentStock),
        minimumStock: Number(form.minimumStock),
        barcode: form.barcode || null,
        hsnCode: form.hsnCode || null,
        description: form.description || null,
      });

      setMessage(response.message);
      setForm(emptyForm);
      void loadProducts();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create product.');
    }
  };

  const handleStockUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await api.updateStock({
        sku: stockForm.sku,
        type: stockForm.type,
        quantity: Number(stockForm.quantity),
        reason: stockForm.reason || 'Inventory update',
        unitCost: stockForm.unitCost ? Number(stockForm.unitCost) : undefined,
      });

      setMessage(response.message);
      setStockForm(stockEmptyForm);
      void loadProducts();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update stock.');
    }
  };

  const lowStockCount = products.filter((product) => product.currentStock <= product.minimumStock).length;

  if (loading) {
    return <div className="text-slate-600">Loading products...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Products</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">{products.length}</h2>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Low Stock</p>
          <h2 className="mt-2 text-3xl font-bold text-amber-600">{lowStockCount}</h2>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Inventory Value</p>
          <h2 className="mt-2 text-3xl font-bold text-emerald-600">
            ₹{products.reduce((sum, product) => sum + product.currentStock * product.purchasePrice, 0).toLocaleString('en-IN')}
          </h2>
        </div>
      </div>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Add Product</h3>
          </div>

          <form onSubmit={handleCreateProduct} className="grid gap-3 md:grid-cols-2">
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Product name" required />
            <input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="SKU" required />
            <input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Barcode" />
            <input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Unit" required />
            <input type="number" value={form.purchasePrice} onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Purchase price" />
            <input type="number" value={form.sellingPrice} onChange={(event) => setForm((current) => ({ ...current, sellingPrice: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Selling price" />
            <input type="number" value={form.mrp} onChange={(event) => setForm((current) => ({ ...current, mrp: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="MRP" />
            <input type="number" value={form.gstRate} onChange={(event) => setForm((current) => ({ ...current, gstRate: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="GST %" />
            <input value={form.hsnCode} onChange={(event) => setForm((current) => ({ ...current, hsnCode: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="HSN code" />
            <input type="number" value={form.currentStock} onChange={(event) => setForm((current) => ({ ...current, currentStock: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Current stock" />
            <input type="number" value={form.minimumStock} onChange={(event) => setForm((current) => ({ ...current, minimumStock: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Minimum stock" />
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="md:col-span-2 min-h-[100px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Description" />
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Save Product</button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">Stock Adjustment</h3>
          <form onSubmit={handleStockUpdate} className="mt-4 space-y-3">
            <input value={stockForm.sku} onChange={(event) => setStockForm((current) => ({ ...current, sku: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="SKU" required />
            <select value={stockForm.type} onChange={(event) => setStockForm((current) => ({ ...current, type: event.target.value as 'STOCK_IN' | 'ADJUSTMENT' | 'DAMAGED' | 'LOST' }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2">
              <option value="STOCK_IN">Stock In</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="DAMAGED">Damaged</option>
              <option value="LOST">Lost</option>
            </select>
            <input type="number" value={stockForm.quantity} onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Quantity" required />
            <input value={stockForm.reason} onChange={(event) => setStockForm((current) => ({ ...current, reason: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Reason" required />
            <input type="number" value={stockForm.unitCost} onChange={(event) => setStockForm((current) => ({ ...current, unitCost: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Unit Cost (optional)" />
            <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Apply Stock Update</button>
          </form>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Product</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">SKU</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Stock</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Price</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3 text-sm text-slate-800">{product.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{product.sku}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={product.currentStock <= product.minimumStock ? 'font-semibold text-amber-600' : 'text-slate-700'}>
                    {product.currentStock} {product.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">₹{product.sellingPrice}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${product.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProductsPage;
