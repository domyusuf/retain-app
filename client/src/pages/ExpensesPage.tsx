import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, ReceiptText } from 'lucide-react';
import type { Expense } from '../../../shared/contracts';
import { useAppDispatch, useAppSelector } from '../store';
import { selectExpensePage } from '../store/selectors';
import { setPage } from '../store/filtersSlice';
import { ExpenseTable } from '../components/ExpenseTable';
import { ExpenseFilters } from '../components/ExpenseFilters';
import { ExpenseForm } from '../components/ExpenseForm';
import { ExpenseDetails } from '../components/ExpenseDetails';

export function ExpensesPage() {
  const page = useAppSelector(selectExpensePage);
  const allCount = useAppSelector((state) => state.financial.expenses.length);
  const dispatch = useAppDispatch();
  const [form, setForm] = useState<Expense | 'new' | null>(null);
  const [detail, setDetail] = useState<Expense | null>(null);
  const [message, setMessage] = useState('');
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <h1>Your expenses</h1>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setMessage('');
            setForm('new');
          }}
        >
          <Plus size={17} />
          Add expense
        </button>
      </div>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      <ExpenseFilters />
      <section className="surface expenses-surface" aria-label="Expense list">
        {page.total ? (
          <ExpenseTable expenses={page.expenses} onSelect={setDetail} />
        ) : (
          <div className="empty-state">
            <ReceiptText size={30} />
            <h2>{allCount ? 'No matching expenses.' : 'No expenses yet.'}</h2>
            {allCount > 0 && <p>Try a different search or clear your filters.</p>}
            {!allCount && (
              <button className="button primary" onClick={() => setForm('new')}>
                Add your first expense
              </button>
            )}
          </div>
        )}
        <div className="pagination">
          <p>
            {page.start}–{page.end} of {page.total} {page.total === 1 ? 'expense' : 'expenses'}
          </p>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={page.page <= 1}
              onClick={() => dispatch(setPage(page.page - 1))}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              Page {page.page} of {page.totalPages}
            </span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={page.page >= page.totalPages}
              onClick={() => dispatch(setPage(page.page + 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {detail && (
        <ExpenseDetails
          expense={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm(detail);
            setDetail(null);
          }}
          onDeleted={() => {
            setDetail(null);
            setMessage('Expense deleted.');
          }}
        />
      )}
      {form && (
        <ExpenseForm expense={form === 'new' ? undefined : form} onClose={() => setForm(null)} />
      )}
    </>
  );
}
