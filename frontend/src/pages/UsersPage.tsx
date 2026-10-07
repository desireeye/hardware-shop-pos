import { useEffect, useState } from 'react';

import { api } from '../services/api';
import type { AuthUser } from '../types/auth';

function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STAFF' as 'STAFF',
  });
  const [message, setMessage] = useState('');

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.users);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load staff users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreateStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await api.createStaff(form);
      setMessage(response.message);
      setForm({ name: '', email: '', password: '', confirmPassword: '', role: 'STAFF' });
      void loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create staff account.');
    }
  };

  const handleToggleStatus = async (userId: string, active: boolean) => {
    try {
      if (active) {
        await api.deactivateUser(userId);
      } else {
        await api.activateUser(userId);
      }

      void loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update staff status.');
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const response = await api.resetPassword(userId);
      setMessage(response.message + ' Temporary password: ' + response.temporaryPassword);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reset password.');
    }
  };

  if (loading) {
    return <div className="text-slate-600">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Users</h2>

        <form onSubmit={handleCreateStaff} className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
            placeholder="Full Name"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
            placeholder="Email"
            required
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
            placeholder="Password"
            required
          />
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
            placeholder="Confirm Password"
            required
          />

          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" className="rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white">
              Create Staff
            </button>
          </div>
        </form>
      </div>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Role</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-sm text-slate-800">{user.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{user.role}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="space-x-2 px-4 py-3 text-sm">
                  <button
                    onClick={() => handleToggleStatus(user.id, Boolean(user.isActive))}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700"
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-brand-700"
                  >
                    Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UsersPage;
