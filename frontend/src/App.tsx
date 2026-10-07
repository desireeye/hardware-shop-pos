import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import AccessDeniedPage from './pages/AccessDeniedPage';
import DashboardPage from './pages/DashboardPage';
import BillingPage from './pages/BillingPage';
import CustomersPage from './pages/CustomersPage';
import InvoicePage from './pages/InvoicePage';
import LoginPage from './pages/LoginPage';
import NewSalePage from './pages/NewSalePage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderReturnPage from './pages/OrderReturnPage';
import OrdersPage from './pages/OrdersPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ProductsPage from './pages/ProductsPage';
import ProfilePage from './pages/ProfilePage';
import PurchasesPage from './pages/PurchasesPage';
import ReportsPage from './pages/ReportsPage';
import ReturnsPage from './pages/ReturnsPage';
import SettingsPage from './pages/SettingsPage';
import SuppliersPage from './pages/SuppliersPage';
import UsersPage from './pages/UsersPage';

const protectedRoutes = [
  { path: '/dashboard', label: 'Dashboard', element: <DashboardPage /> },
  { path: '/new-sale', label: 'New Sale', element: <NewSalePage /> },
  { path: '/orders', label: 'Orders', element: <OrdersPage /> },
  { path: '/products', label: 'Products', element: <ProductsPage /> },
  { path: '/customers', label: 'Customers', element: <CustomersPage /> },
  { path: '/billing', label: 'Billing', element: <BillingPage /> },
  { path: '/returns', label: 'Returns', element: <ReturnsPage /> },
  { path: '/suppliers', label: 'Suppliers', element: <SuppliersPage />, adminOnly: true },
  { path: '/purchases', label: 'Purchases', element: <PurchasesPage />, adminOnly: true },
  { path: '/reports', label: 'Reports', element: <ReportsPage />, adminOnly: true },
  { path: '/settings', label: 'Settings', element: <SettingsPage />, adminOnly: true },
  { path: '/profile', label: 'Profile', element: <ProfilePage /> },
];

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          {protectedRoutes.map((route) => {
            const routeElement = route.adminOnly ? (
              <RoleProtectedRoute allowedRoles={['ADMIN']}>{route.element}</RoleProtectedRoute>
            ) : (
              route.element
            );

            return <Route key={route.path} path={route.path.replace('/', '')} element={routeElement} />;
          })}
          <Route
            path="users"
            element={
              <RoleProtectedRoute allowedRoles={['ADMIN']}>
                <UsersPage />
              </RoleProtectedRoute>
            }
          />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="orders/:id/return" element={<OrderReturnPage />} />
          <Route path="invoices/:id" element={<InvoicePage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
