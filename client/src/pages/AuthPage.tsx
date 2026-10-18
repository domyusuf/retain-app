import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/api';

export function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const signup = mode === 'signup';
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setPending(true);
    try {
      if (signup) await signUp({ name: name.trim(), email: email.trim(), password });
      else await signIn({ email: email.trim(), password });
      const state: unknown = location.state;
      const from =
        typeof state === 'object' &&
        state !== null &&
        'from' in state &&
        typeof state.from === 'string'
          ? state.from
          : '/dashboard';
      navigate(from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard', {
        replace: true,
      });
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story" aria-label="About Retain">
        <Brand light />
        <div className="story-content">
          <h2>
            Keep track of
            <br />
            your spending.
            <br />
            <em>Plan your month.</em>
          </h2>
          <p className="story-description">Record expenses, set a budget, and see what’s left.</p>
          <div className="growth-art" aria-hidden="true">
            <div className="art-circle" />
            <div className="art-ground" />
            <span className="art-leaf leaf-one" />
            <span className="art-leaf leaf-two" />
            <span className="art-leaf leaf-three" />
            <span className="art-stem" />
          </div>
        </div>
      </aside>
      <main className="auth-main">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-card">
          <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-intro">
            {signup
              ? 'Start tracking your expenses and monthly budget.'
              : 'Sign in to view your expenses and budget.'}
          </p>
          <form onSubmit={submit} className="auth-form">
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {signup && (
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={pending}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  required
                  minLength={signup ? 12 : 1}
                  maxLength={128}
                  aria-describedby={signup ? 'password-help' : undefined}
                  placeholder={signup ? 'At least 12 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {signup && <small id="password-help">Use at least 12 characters.</small>}
            </div>
            <button className="button primary auth-submit" type="submit" disabled={pending}>
              {pending ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  {signup ? 'Creating your account…' : 'Signing in…'}
                </>
              ) : (
                <>
                  {signup ? 'Create account' : 'Sign in'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to Retain?'}{' '}
            <Link to={signup ? '/signin' : '/signup'}>
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
        <p className="auth-footer">© {new Date().getFullYear()} Retain</p>
      </main>
    </div>
  );
}
