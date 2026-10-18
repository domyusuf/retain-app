import { useState } from 'react';
import type { Expense } from '../../../shared/contracts';
import { useAppDispatch, useAppSelector } from '../store';
import { useAuth } from '../auth/AuthContext';
import { deleteExpense } from '../store/financialSlice';
import { displayDate, money, paymentLabels } from '../lib/money';
import { Modal } from './Modal';

export function ExpenseDetails({
  expense,
  onClose,
  onEdit,
  onDeleted,
}: {
  expense: Expense;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.financial.categories);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!user || pending) return;
    setPending(true);
    setError('');
    try {
      await dispatch(deleteExpense({ ownerId: user.id, id: expense.id })).unwrap();
      onDeleted();
    } catch (error: unknown) {
      setError(
        typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
          ? error.message
          : 'This expense could not be deleted. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={confirming ? 'Delete this expense?' : 'Expense details'}
      onClose={onClose}
      pending={pending}
    >
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {confirming ? (
        <p className="form-intro">
          “{expense.title}” ({money(expense.amountMinor)}) will be permanently deleted.
        </p>
      ) : (
        <>
          <p className="detail-amount">{money(expense.amountMinor)}</p>
          <h3 className="detail-title">{expense.title}</h3>
          <dl className="detail-list">
            <div>
              <dt>Date</dt>
              <dd>{displayDate(expense.date)}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>
                {categories.find((c) => c.id === expense.categoryId)?.name || 'Uncategorized'}
              </dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{paymentLabels[expense.paymentMethod]}</dd>
            </div>
            {expense.notes && (
              <div>
                <dt>Notes</dt>
                <dd className="detail-notes">{expense.notes}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      <div className="modal-actions">
        {confirming ? (
          <>
            <button
              className="button subtle"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Keep expense
            </button>
            <button className="button danger" onClick={remove} disabled={pending}>
              {pending ? 'Deleting…' : 'Delete expense'}
            </button>
          </>
        ) : (
          <>
            <button className="button text-danger" onClick={() => setConfirming(true)}>
              Delete expense
            </button>
            <button className="button primary" onClick={onEdit}>
              Edit expense
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
