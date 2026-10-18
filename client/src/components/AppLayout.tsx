import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ShieldCheck,
  LayoutDashboard,
  ReceiptText,
  Wallet,
  UserRound,
  LogOut,
  RefreshCw,
  LoaderCircle,
  AlertCircle,
} from 'lucide-react';
import { Brand } from './Brand';
import { useAuth } from '../auth/AuthContext';
import { useAppDispatch, useAppSelector } from '../store';
import { resetFilters } from '../store/filtersSlice';
import { clearFinancialData, loadFinancialData } from '../store/financialSlice';
import { errorMessage } from '../lib/api';

export function AppLayout() {
  const { user, signOut } = useAuth();
  const dispatch = useAppDispatch();
  const { ownerId, status, error } = useAppSelector((state) => state.financial);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    if (!user) return;
    dispatch(resetFilters());
    dispatch(clearFinancialData());
    const promise = dispatch(loadFinancialData(user.id));
    return () => {
      promise.abort();
    };
  }, [user?.id, dispatch]);
  if (!user) return null;
  const ready = ownerId === user.id && status === 'ready';
  async function logout() {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await signOut();
    } catch (error: unknown) {
      setLogoutError(errorMessage(error));
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="workspace-shell">
      <a href="#workspace-content" className="skip-link">
        Skip to main content
      </a>
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Main navigation">
          <NavLink to="/dashboard">
            <LayoutDashboard size={18} />
            Overview
          </NavLink>
          <NavLink to="/expenses">
            <ReceiptText size={18} />
            Expenses
          </NavLink>
          <NavLink to="/budget">
            <Wallet size={18} />
            Budget
          </NavLink>
          <NavLink to="/account">
            <UserRound size={18} />
            Account
          </NavLink>
          {user.role === 'admin' && (
            <NavLink to="/admin">
              <ShieldCheck size={18} />
              Admin
            </NavLink>
          )}
        </nav>
        <p className="sidebar-currency">Reporting currency: RWF</p>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <div className="compact-brand">
            <Brand />
          </div>
          <div className="workspace-header-actions">
            <button
              className="icon-button"
              title="Refresh data"
              aria-label="Refresh data"
              onClick={() => dispatch(loadFinancialData(user.id))}
              disabled={status === 'loading'}
            >
              <RefreshCw size={17} className={status === 'loading' ? 'spin' : ''} />
            </button>
            <span className="avatar" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="header-name">{user.name}</span>
            <button className="button subtle" onClick={logout} disabled={loggingOut}>
              <LogOut size={16} />
              <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </header>
        <main className="workspace-main" id="workspace-content" tabIndex={-1}>
          {logoutError && (
            <div className="form-error" role="alert">
              {logoutError}
            </div>
          )}
          {ready ? (
            <Outlet />
          ) : status === 'failed' ? (
            <section className="data-state" role="alert">
              <AlertCircle size={30} />
              <h1>We couldn’t load your data.</h1>
              <p>{error}</p>
              <button
                className="button primary"
                onClick={() => dispatch(loadFinancialData(user.id))}
              >
                Try again
              </button>
            </section>
          ) : (
            <div className="data-state" role="status">
              <LoaderCircle className="spin" size={25} />
              <p>Loading your data…</p>
            </div>
          )}
        </main>
        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} Retain</span>
        </footer>
      </div>
    </div>
  );
}
