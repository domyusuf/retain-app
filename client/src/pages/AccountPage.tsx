import { useState } from 'react';
import { ArrowUpRight, Check, LogOut, ShieldCheck, Sprout } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { errorMessage } from '../lib/api';

export function AccountPage() {
  const { user, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!user) return null;
  async function logout() {
    setPending(true);
    setError('');
    try {
      await signOut();
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <div className="account-actions">
          <span className="avatar" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="header-name">{user.name}</span>
          <button className="button subtle" onClick={logout} disabled={pending}>
            <LogOut size={17} />
            {pending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <main className="account-main">
        <div className="page-heading">
          <p className="eyebrow muted">YOUR RETAIN ACCOUNT</p>
          <h1>
            Welcome, {user.name.split(' ')[0]}
            <span className="brand-dot">.</span>
          </h1>
          <p>A fresh start for a clearer relationship with your money.</p>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="account-grid">
          <section className="welcome-panel">
            <span className="round-icon">
              <Sprout size={29} />
            </span>
            <h2>
              Good habits start
              <br />
              with a little clarity.
            </h2>
            <p>Give your spending a home, and make space for the things that matter to you.</p>
            <div className="welcome-note">
              <Check size={16} /> You’re signed in and ready to go.
            </div>
            <ArrowUpRight className="welcome-arrow" size={58} strokeWidth={1} aria-hidden="true" />
          </section>
          <section className="profile-panel" aria-labelledby="profile-title">
            <div className="panel-heading">
              <h2 id="profile-title">Your profile</h2>
              <ShieldCheck size={20} />
            </div>
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>Email address</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Account type</dt>
                <dd>
                  <span className="role-badge">
                    {user.role === 'admin' ? 'Administrator' : 'Personal account'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>
                  {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                    new Date(user.createdAt),
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
      <footer className="app-footer">
        A little clarity goes a long way.<span>© {new Date().getFullYear()} Retain</span>
      </footer>
    </div>
  );
}
