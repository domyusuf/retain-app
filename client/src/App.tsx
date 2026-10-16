import { useEffect } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { resetFilters } from './store/filtersSlice';
import { useAppDispatch } from './store';

export default function App() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(resetFilters());
  }, [user?.id, dispatch]);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<GuestRoute />}>
        <Route path="/signin" element={<AuthPage key="signin" mode="signin" />} />
        <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<AccountPage />} />
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
