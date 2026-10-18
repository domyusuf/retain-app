import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Wallet, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useAppDispatch, useAppSelector } from '../store';
import { saveBudget } from '../store/financialSlice';
import { selectMonthlySummary } from '../store/selectors';
import { amountInput, displayMonth, parseAmount } from '../lib/money';
import { MonthPicker } from '../components/MonthPicker';
import { BudgetProgress } from '../components/BudgetProgress';
export function BudgetPage() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const summary = useAppSelector(selectMonthlySummary);
  const [amount, setAmount] = useState(
    summary.budget ? amountInput(summary.budget.amountMinor) : '',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setAmount(summary.budget ? amountInput(summary.budget.amountMinor) : '');
  }, [summary.month, summary.budget?.amountMinor]);
  useEffect(() => {
    setError('');
    setSaved(false);
  }, [summary.month]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || pending) return;
    const amountMinor = parseAmount(amount);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter a budget greater than zero with up to two decimal places.');
      return;
    }
    setPending(true);
    setError('');
    setSaved(false);
    try {
      await dispatch(saveBudget({ ownerId: user.id, month: summary.month, amountMinor })).unwrap();
      setSaved(true);
    } catch (error: unknown) {
      setError(
        typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
          ? error.message
          : 'Your budget could not be saved. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <h1>Your budget</h1>
        </div>
        <MonthPicker disabled={pending} />
      </div>
      <div className="budget-page-grid">
        <section className="surface budget-editor">
          <span className="round-icon">
            <Wallet size={26} />
          </span>
          <h2>{summary.budget ? 'Update budget' : 'Set a budget'}</h2>
          <p className="form-intro">
            Set your spending limit for {displayMonth(summary.month)}. You can update it anytime.
          </p>
          <form onSubmit={submit}>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {saved && (
              <p className="success-message" role="status">
                <Check size={16} />
                Budget saved.
              </p>
            )}
            <div className="field">
              <label htmlFor="budget-amount">Monthly budget (RWF)</label>
              <input
                id="budget-amount"
                inputMode="decimal"
                required
                placeholder="e.g. 150000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setSaved(false);
                }}
                disabled={pending}
              />
            </div>
            <button className="button primary" type="submit" disabled={pending}>
              {pending && <LoaderCircle className="spin" size={16} />}
              {pending ? 'Saving…' : summary.budget ? 'Update budget' : 'Save budget'}
            </button>
          </form>
        </section>
        <div>
          <BudgetProgress showLink={false} />
          <p className="budget-footnote">
            Totals include all expenses dated in {displayMonth(summary.month)}.
          </p>
        </div>
      </div>
    </>
  );
}
