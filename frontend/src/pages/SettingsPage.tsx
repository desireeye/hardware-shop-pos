import { useEffect, useState } from 'react';

import { api } from '../services/api';

type SettingsState = {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  shopGstin: string;
  invoiceFooter: string;
  returnPolicy: string;
  defaultPageSize: number;
  currencySymbol: string;
};

const emptySettings: SettingsState = {
  shopName: '',
  shopAddress: '',
  shopPhone: '',
  shopEmail: '',
  shopGstin: '',
  invoiceFooter: '',
  returnPolicy: '',
  defaultPageSize: 20,
  currencySymbol: '₹',
};

function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.getSettings();
        setSettings(response.settings);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load settings.');
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleChange = (field: keyof SettingsState, value: string | number) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await api.updateSettings({
        shopName: settings.shopName,
        shopAddress: settings.shopAddress,
        shopPhone: settings.shopPhone,
        shopEmail: settings.shopEmail,
        shopGstin: settings.shopGstin,
        invoiceFooter: settings.invoiceFooter,
        returnPolicy: settings.returnPolicy,
        defaultPageSize: settings.defaultPageSize,
        currencySymbol: settings.currencySymbol,
      });

      setMessage(response.message);
      setSettings(response.settings);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-600">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Shop Settings</h2>
        <p className="mt-1 text-sm text-slate-600">Configure default invoice, storefront, and business details.</p>
      </div>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Shop Name
            <input value={settings.shopName} onChange={(event) => handleChange('shopName', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Phone
            <input value={settings.shopPhone} onChange={(event) => handleChange('shopPhone', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Address
            <input value={settings.shopAddress} onChange={(event) => handleChange('shopAddress', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Email
            <input value={settings.shopEmail} onChange={(event) => handleChange('shopEmail', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            GSTIN
            <input value={settings.shopGstin} onChange={(event) => handleChange('shopGstin', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Default Page Size
            <input type="number" min={10} max={200} value={settings.defaultPageSize} onChange={(event) => handleChange('defaultPageSize', Number(event.target.value))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Currency Symbol
            <input value={settings.currencySymbol} onChange={(event) => handleChange('currencySymbol', event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Invoice Footer
            <textarea value={settings.invoiceFooter} onChange={(event) => handleChange('invoiceFooter', event.target.value)} className="min-h-[100px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Return Policy
            <textarea value={settings.returnPolicy} onChange={(event) => handleChange('returnPolicy', event.target.value)} className="min-h-[100px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
        </div>

        <div className="mt-6">
          <button type="submit" disabled={saving} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SettingsPage;
