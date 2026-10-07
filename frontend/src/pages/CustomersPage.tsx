import { useEffect, useMemo, useState } from 'react';

import { api } from '../services/api';
import type { Customer, CustomerPurchaseHistoryItem } from '../types/customer';

const emptyForm = {
  name: '',
  phone: '',
  address: '',
};

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<CustomerPurchaseHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCustomers = async (nextPage = page, nextSearch = search) => {
    setLoading(true);
    try {
      const response = await api.getCustomers({ page: nextPage, pageSize, search: nextSearch });
      setCustomers(response.customers);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCustomers(1, search);
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(customers.length / pageSize) || 1), [customers.length, pageSize]);

  const openNewCustomerModal = () => {
    setEditingCustomerId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditCustomerModal = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      address: customer.address ?? '',
    });
    setIsModalOpen(true);
  };

  const handleViewDetails = async (customerId: string) => {
    try {
      const response = await api.getCustomerById(customerId);
      setSelectedCustomer(response.customer);
      setPurchaseHistory(response.purchaseHistory);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load customer details.');
    }
  };

  const handleSaveCustomer = async () => {
    if (!form.name.trim()) {
      setError('Customer name is required.');
      return;
    }

    try {
      if (editingCustomerId) {
        await api.updateCustomer(editingCustomerId, {
          name: form.name,
          phone: form.phone,
          address: form.address,
        });
      } else {
        await api.createCustomer({
          name: form.name,
          phone: form.phone,
          address: form.address,
        });
      }

      setIsModalOpen(false);
      setForm(emptyForm);
      setError('');
      await loadCustomers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save customer.');
    }
  };

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Customer Management</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Customers</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or phone"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none"
            />
            <button onClick={openNewCustomerModal} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">
              + Add Customer
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Orders</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Purchases</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Loading customers...</td></tr>
              ) : customers.length ? customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{customer.name}</td>
                  <td className="px-4 py-3 text-slate-700">{customer.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{customer.totalOrders ?? 0}</td>
                  <td className="px-4 py-3 text-slate-700">₹{(customer.totalPurchases ?? 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => void handleViewDetails(customer.id)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700">View</button>
                      <button onClick={() => openEditCustomerModal(customer)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700">Edit</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No customers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-600">
          <button disabled={page <= 1} onClick={() => { const nextPage = page - 1; setPage(nextPage); void loadCustomers(nextPage, search); }} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => { const nextPage = page + 1; setPage(nextPage); void loadCustomers(nextPage, search); }} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">Next</button>
        </div>
      </div>

      {selectedCustomer ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Customer Details</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{selectedCustomer.name}</h3>
            </div>
            <button onClick={() => openEditCustomerModal(selectedCustomer)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">Edit</button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.14em] text-slate-400">Phone</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedCustomer.phone ?? '—'}</div></div>
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.14em] text-slate-400">Address</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedCustomer.address ?? '—'}</div></div>
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.14em] text-slate-400">Total Orders</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedCustomer.totalOrders ?? 0}</div></div>
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs uppercase tracking-[0.14em] text-slate-400">Total Purchases</div><div className="mt-2 text-sm font-medium text-slate-900">₹{(selectedCustomer.totalPurchases ?? 0).toLocaleString('en-IN')}</div></div>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Purchase History</div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Invoice</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Total</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {purchaseHistory.length ? purchaseHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-slate-700">{entry.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-slate-700">₹{entry.total.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.orderStatus}</td>
                    </tr>
                  )) : <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No purchases yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{editingCustomerId ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-sm text-slate-500">Close</button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Name
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              </label>

              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Phone
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              </label>

              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Address
                <textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="min-h-[90px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button onClick={() => void handleSaveCustomer()} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CustomersPage;
