import { Navigate, Route, Routes } from 'react-router-dom';

import { URLS } from '@/helpers';
import { Layout, ProtectedRoute } from '@/layouts';
import { LoginPage } from '@/modules/authentication/pages';
import { OrdersPage } from '@/modules/orders/pages';

export function App() {
  return (
    <Routes>
      <Route path={URLS.login} element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path={URLS.orders} element={<OrdersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={URLS.orders} replace />} />
    </Routes>
  );
}
