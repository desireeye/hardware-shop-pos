import { type FormEvent, useEffect, useState } from 'react';

import { api } from '../services/api';
import type { Supplier } from '../types/supplier';

const initialForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
};

function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSuppliers = async () => {
    try {
      const response = await api.getSuppliers();
      setSuppliers(response.suppliers);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load suppliers.');
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.createSupplier({
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        gstin: form.gstin || undefined,
      });
      setForm(initialForm);
      setSuccess('Supplier created successfully.');
      await loadSuppliers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create supplier.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Suppliers</h2>
        <p className="mt-1 text-sm text-slate-600">Manage vendor contacts and stock purchase history.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Supplier List</h3>
          <div className="mt-4 space-y-3">
            {suppliers.length === 0 ? (
              <p className="text-sm text-slate-500">No suppliers created yet.</p>
            ) : (
              suppliers.map((supplier) => (
                <div key={supplier.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{supplier.name}</p>
                      <p className="text-sm text-slate-600">{supplier.phone ?? 'No phone'} • {supplier.email ?? 'No email'}</p>
                    </div>
                    <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">Vendor</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{supplier.address ?? 'No address added'}</p>
                  <p className="mt-1 text-xs text-slate-500">GSTIN: {supplier.gstin ?? 'Not provided'}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Add Supplier</h3>
          {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

          <div className="mt-4 grid gap-3">
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Supplier name" required />
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Phone number" />
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Email" />
            <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="Address" />
            <input value={form.gstin} onChange={(event) => setForm((current) => ({ ...current, gstin: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" placeholder="GSTIN" />
          </div>

          <button type="submit" className="mt-5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Save Supplier</button>
        </form>
      </div>
    </div>
  );
}

export default SuppliersPage;
