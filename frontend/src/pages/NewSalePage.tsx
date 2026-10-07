import { useEffect, useMemo, useState } from 'react';

import { api } from '../services/api';
import type { Product } from '../types/product';

type CartItem = {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  gstRate: number;
  quantity: number;
  discountAmount: number;
};

function NewSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Array<{ id: string; name: string; phone: string | null }>>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT'>('CASH');
  const [amountPaid, setAmountPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await api.getProducts();
        setProducts(response.products.filter((product) => product.isActive));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load products.');
      }
    };

    void loadProducts();
  }, []);

  useEffect(() => {
    const loadCustomerSuggestions = async () => {
      const trimmedSearch = customerSearch.trim();
      if (!trimmedSearch) {
        setCustomerSuggestions([]);
        return;
      }

      try {
        const response = await api.getCustomers({ page: 1, pageSize: 5, search: trimmedSearch });
        setCustomerSuggestions(response.customers);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load customer suggestions.');
      }
    };

    const timeout = window.setTimeout(() => {
      void loadCustomerSuggestions();
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [customerSearch]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return true;

        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          (product.barcode ?? '').toLowerCase().includes(query)
        );
      }),
    [products, searchTerm],
  );

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = cart.reduce((sum, item) => sum + Math.min(item.discountAmount, item.unitPrice * item.quantity), 0);
  const taxableAmount = cart.reduce((sum, item) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const appliedDiscount = Math.min(item.discountAmount, lineSubtotal);
    return sum + Math.max(lineSubtotal - appliedDiscount, 0);
  }, 0);
  const taxAmount = cart.reduce((sum, item) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const appliedDiscount = Math.min(item.discountAmount, lineSubtotal);
    const taxableValue = Math.max(lineSubtotal - appliedDiscount, 0);
    return sum + (taxableValue * item.gstRate) / 100;
  }, 0);
  const grandTotal = Math.max(taxableAmount + taxAmount - discountAmount, 0);
  const balanceDue = Math.max(grandTotal - Number(amountPaid || 0), 0);

  const handleSelectCustomer = (customer: { id: string; name: string; phone: string | null }) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone ?? '');
    setCustomerSearch('');
    setCustomerSuggestions([]);
    setError('');
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomer.name.trim()) {
      setError('Customer name is required.');
      return;
    }

    try {
      const response = await api.createCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone,
        address: newCustomer.address,
      });

      handleSelectCustomer(response.customer);
      setNewCustomer({ name: '', phone: '', address: '' });
      setCustomerModalOpen(false);
      setMessage('Customer created and selected for this sale.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create customer.');
    }
  };

  const handleAddToCart = (product: Product) => {
    setError('');
    setMessage('');

    setCart((current) => {
      const existing = current.find((entry) => entry.id === product.id);

      if (existing) {
        return current.map((entry) =>
          entry.id === product.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.sellingPrice,
          gstRate: product.gstRate,
          quantity: 1,
          discountAmount: 0,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, nextQuantity: number) => {
    setCart((current) =>
      current
        .map((entry) => (entry.id === productId ? { ...entry, quantity: Math.max(0, nextQuantity) } : entry))
        .filter((entry) => entry.quantity > 0),
    );
  };

  const updateDiscount = (productId: string, nextDiscount: number) => {
    setCart((current) =>
      current.map((entry) =>
        entry.id === productId ? { ...entry, discountAmount: Math.max(0, nextDiscount) } : entry,
      ),
    );
  };

  const handleCheckout = async () => {
    if (!cart.length) {
      setError('Add at least one product to the cart before checkout.');
      return;
    }

    if (Number(amountPaid) < 0) {
      setError('Amount paid cannot be negative.');
      return;
    }

    try {
      const response = await api.checkoutSale({
        customerName,
        customerPhone,
        customerEmail,
        paymentMethod,
        amountPaid: Number(amountPaid || grandTotal),
        discountAmount: discountAmount,
        notes,
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: Math.min(item.discountAmount, item.unitPrice * item.quantity),
        })),
      });

      setMessage(`${response.message} Invoice: ${response.order.invoiceNumber}`);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setAmountPaid('0');
      setNotes('');
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to complete sale.');
    }
  };

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">New Sale</h2>
            <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              {cart.length} items
            </div>
          </div>

          <div className="mb-4">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search products by name, SKU, or barcode"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ring-0"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredProducts.map((product) => (
              <div key={product.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.sku}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    Stock: {product.currentStock}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">₹{product.sellingPrice}</p>
                    <p className="text-xs text-slate-500">GST {product.gstRate}%</p>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">Checkout</h3>

          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">Customer</span>
                <button onClick={() => setCustomerModalOpen(true)} className="text-xs font-semibold text-brand-600">+ Add Customer</button>
              </div>
              <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Search existing customer" />
              {customerSuggestions.length ? (
                <div className="mt-2 space-y-1">
                  {customerSuggestions.map((customer) => (
                    <button key={customer.id} onClick={() => handleSelectCustomer(customer)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-sm">
                      <span className="font-medium text-slate-800">{customer.name}</span>
                      <span className="text-slate-500">{customer.phone ?? 'No phone'}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600">
                {selectedCustomerId ? `Selected: ${customerName}` : 'Walk-in customer'}
              </div>
            </div>
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" placeholder="Customer name" />
            <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" placeholder="Phone" />
            <input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" placeholder="Email" />
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT')} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CREDIT">Credit</option>
            </select>
            <input type="number" min="0" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" placeholder="Amount received" />
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[80px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" placeholder="Sale notes" />
          </div>

          <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Discount</span>
              <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Tax</span>
              <span>₹{taxAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
              <span>Total</span>
              <span>₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Balance</span>
              <span>₹{balanceDue.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button onClick={handleCheckout} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
            Process Sale
          </button>
        </aside>
      </div>

      {customerModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Add Customer</h3>
              <button onClick={() => setCustomerModalOpen(false)} className="text-sm text-slate-500">Close</button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Name
                <input value={newCustomer.name} onChange={(event) => setNewCustomer((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Phone
                <input value={newCustomer.phone} onChange={(event) => setNewCustomer((current) => ({ ...current, phone: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Address
                <textarea value={newCustomer.address} onChange={(event) => setNewCustomer((current) => ({ ...current, address: event.target.value }))} className="min-h-[90px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCustomerModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button onClick={() => void handleSaveNewCustomer()} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Product</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Qty</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Discount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {cart.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                  Cart is empty. Search a product and add it to begin the sale.
                </td>
              </tr>
            ) : (
              cart.map((item) => {
                const lineTotal = item.unitPrice * item.quantity;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-slate-800">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-7 w-7 rounded-lg border border-slate-300 bg-slate-100">-</button>
                        <span className="min-w-[20px] text-center font-medium">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-7 w-7 rounded-lg border border-slate-300 bg-slate-100">+</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <input
                        type="number"
                        min="0"
                        value={item.discountAmount}
                        onChange={(event) => updateDiscount(item.id, Number(event.target.value))}
                        className="w-20 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      ₹{Math.max(lineTotal - item.discountAmount, 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default NewSalePage;
