import { useEffect } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { AdminPage } from './pages/AdminPage';
import { BudgetPage } from './pages/BudgetPage';
import { AppLayout } from './components/AppLayout';
import { clearFinancialData } from './store/financialSlice';
import { resetFilters } from './store/filtersSlice';
import { useAppDispatch } from './store';

export default function App() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!user) {
      dispatch(resetFilters());
      dispatch(clearFinancialData());
    }
  }, [user?.id, dispatch]);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<GuestRoute />}>
        <Route path="/signin" element={<AuthPage key="signin" mode="signin" />} />
        <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout key={user?.id} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <main className="not-found">
            <p className="eyebrow muted">404</p>
            <h1>That page isn’t here.</h1>
            <p>Let’s get you back to familiar ground.</p>
            <Link className="button primary" to="/dashboard">
              Back to Retain
            </Link>
          </main>
        }
      />
    </Routes>
  );
}
