import { useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { Expense, PaymentMethod } from '../../../shared/contracts';
import { useAuth } from '../auth/AuthContext';
import { useAppDispatch, useAppSelector } from '../store';
import { saveExpense } from '../store/financialSlice';
import { amountInput, localDate, parseAmount, paymentLabels } from '../lib/money';
import { Modal } from './Modal';

export function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.financial.categories);
  const [title, setTitle] = useState(expense?.title || '');
  const [amount, setAmount] = useState(expense ? amountInput(expense.amountMinor) : '');
  const [date, setDate] = useState(expense?.date || localDate());
  const [categoryId, setCategoryId] = useState(expense?.categoryId || 'uncategorized');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    expense?.paymentMethod || 'cash',
  );
  const [notes, setNotes] = useState(expense?.notes || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || pending) return;
    const amountMinor = parseAmount(amount);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than zero, with up to two decimal places.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await dispatch(
        saveExpense({
          ownerId: user.id,
          id: expense?.id,
          input: {
            title: title.trim(),
            amountMinor,
            date,
            categoryId,
            paymentMethod,
            notes: notes.trim(),
          },
        }),
      ).unwrap();
      onClose();
    } catch (error: unknown) {
      setError(
        typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
          ? error.message
          : 'Your expense could not be saved. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose} pending={pending}>
      <form onSubmit={submit} className="expense-form">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={pending}>
          <div className="field">
            <label htmlFor="expense-title">Title</label>
            <input
              id="expense-title"
              autoFocus
              maxLength={120}
              required
              placeholder="e.g. Lunch with friends"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="expense-amount">Amount (RWF)</label>
              <input
                id="expense-amount"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="expense-date">Date</label>
              <input
                id="expense-date"
                type="date"
                required
                min="1900-01-01"
                max="9999-12-31"
                value={date}
                onInput={(e) => setDate(e.currentTarget.value)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="expense-category">Category</label>
              <select
                id="expense-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="expense-payment">Payment method</label>
              <select
                id="expense-payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="expense-notes">
              Notes <span className="optional">(optional)</span>
            </label>
            <textarea
              id="expense-notes"
              rows={3}
              maxLength={2000}
              placeholder="Add a note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </fieldset>
        <div className="modal-actions">
          <button className="button subtle" type="button" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={pending}>
            {pending && <LoaderCircle size={16} className="spin" />}
            {pending ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
