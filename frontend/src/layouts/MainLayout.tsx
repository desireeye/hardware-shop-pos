import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const adminNavigationItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'New Sale', to: '/new-sale' },
  { label: 'Orders', to: '/orders' },
  { label: 'Products', to: '/products' },
  { label: 'Customers', to: '/customers' },
  { label: 'Billing', to: '/billing' },
  { label: 'Returns', to: '/returns' },
  { label: 'Suppliers', to: '/suppliers' },
  { label: 'Purchases', to: '/purchases' },
  { label: 'Reports', to: '/reports' },
  { label: 'Users', to: '/users' },
  { label: 'Settings', to: '/settings' },
];

const staffNavigationItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'New Sale', to: '/new-sale' },
  { label: 'Orders', to: '/orders' },
  { label: 'Products', to: '/products' },
  { label: 'Customers', to: '/customers' },
  { label: 'Billing', to: '/billing' },
  { label: 'Returns', to: '/returns' },
];

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navigationItems = user?.role === 'ADMIN' ? adminNavigationItems : staffNavigationItems;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-500">Hardware Shop</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">POS Console</h1>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-5">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center rounded-xl px-4 py-3 text-base font-medium transition ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-soft'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Daily Operations</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Sales & Inventory Overview</h2>
            </div>

            <div className="flex items-center gap-3">
              <button className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                Quick Search
              </button>
              <button className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft">
                New Sale
              </button>

              <div className="ml-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">{user?.name ?? 'User'}</div>
                  <div className="text-xs text-slate-500">{user?.role ?? 'STAFF'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <NavLink to="/profile" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                    Profile
                  </NavLink>
                  <button onClick={handleLogout} className="text-sm font-medium text-red-600 hover:text-red-700">
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-5 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
