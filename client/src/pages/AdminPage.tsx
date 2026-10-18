import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type {
  Category,
  CategoryInput,
  CategorySpending,
  PlatformInsights,
} from '../../../shared/contracts';
import { useAuth } from '../auth/AuthContext';
import { useAppDispatch, useAppSelector } from '../store';
import { refreshCategories } from '../store/financialSlice';
import { apiRequest, errorMessage } from '../lib/api';
import { displayDate, displayMonth, money } from '../lib/money';
import { Modal } from '../components/Modal';

function CategoryList({ title, items }: { title: string; items: CategorySpending[] }) {
  return (
    <section className="surface admin-panel">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <ul className="admin-list">
        {items.map((item) => (
          <li key={item.categoryId}>
            <span>{item.name}</span>
            <strong>
              {item.count} {item.count === 1 ? 'expense' : 'expenses'}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
export function AdminPage() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.financial.categories);
  const [insights, setInsights] = useState<PlatformInsights | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [input, setInput] = useState<CategoryInput>({ name: '', color: '#386b53' });
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      setInsights(await apiRequest<PlatformInsights>('/admin/insights', { signal }));
    } catch (error: unknown) {
      if (!signal?.aborted) setError(errorMessage(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  function edit(category: Category | 'new') {
    setMutationError('');
    setInput(
      category === 'new'
        ? { name: '', color: '#386b53' }
        : { name: category.name, color: category.color },
    );
    setEditing(category);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !user || pending) return;
    setPending(true);
    setMutationError('');
    try {
      await apiRequest<{ category: Category }>(
        editing === 'new'
          ? '/admin/categories'
          : `/admin/categories/${encodeURIComponent(editing.id)}`,
        { method: editing === 'new' ? 'POST' : 'PUT', body: JSON.stringify(input) },
      );
      setEditing(null);
      setMessage('Category saved.');
      await dispatch(refreshCategories(user.id)).unwrap();
      await load();
    } catch (error: unknown) {
      setMutationError(errorMessage(error));
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (!deleting || !user || pending) return;
    setPending(true);
    setMutationError('');
    try {
      const result = await apiRequest<{ reassignedCount: number }>(
        `/admin/categories/${encodeURIComponent(deleting.id)}`,
        { method: 'DELETE' },
      );
      setDeleting(null);
      setMessage(`Category deleted. ${result.reassignedCount} expenses moved to Uncategorized.`);
      await dispatch(refreshCategories(user.id)).unwrap();
      await load();
    } catch (error: unknown) {
      setMutationError(errorMessage(error));
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <h1>Admin overview</h1>
          <p>User activity and shared categories across Retain.</p>
        </div>
        <button
          className="button secondary"
          disabled={loading || pending}
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
          Refresh insights
        </button>
      </div>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
          <button className="button subtle" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {loading && <p role="status">Loading platform insights…</p>}
      {insights && (
        <>
          <div className="stat-grid admin-stats">
            <section className="stat-card">
              <div className="stat-label">Registered users</div>
              <strong>{insights.userCount}</strong>
            </section>
            <section className="stat-card">
              <div className="stat-label">Total expenses</div>
              <strong>{insights.expenseCount}</strong>
            </section>
            <section className="stat-card">
              <div className="stat-label">Total expense value</div>
              <strong>{money(insights.expenseValueMinor)}</strong>
            </section>
            <section className="stat-card">
              <div className="stat-label">Expenses this month</div>
              <strong>{insights.currentMonthExpenseCount}</strong>
              <p>{displayMonth(insights.month)} · Kigali time</p>
            </section>
          </div>
          <section className="surface admin-panel">
            <div className="section-heading">
              <h2>Total spending by category</h2>
              <span className="subtle-label">All time · RWF</span>
            </div>
            <ul className="admin-list">
              {insights.byCategory.map((item) => (
                <li key={item.categoryId}>
                  <span>{item.name}</span>
                  <strong>{money(item.amountMinor)}</strong>
                </li>
              ))}
            </ul>
          </section>
          <div className="dashboard-grid">
            <CategoryList title="Top 5 most-used categories" items={insights.mostUsed} />
            <CategoryList title="Bottom 5 least-used categories" items={insights.leastUsed} />
          </div>
          <div className="dashboard-grid">
            <section className="surface admin-panel">
              <div className="section-heading">
                <h2>Recent expenses</h2>
              </div>
              <p className="subtle-label">Latest 10 recorded across all users</p>
              {insights.recentExpenses.length ? (
                <ul className="admin-list">
                  {insights.recentExpenses.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.title}
                        <small>
                          {item.ownerName} · {item.categoryName} · {displayDate(item.date)}
                        </small>
                      </span>
                      <strong>{money(item.amountMinor)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small-empty">No expenses recorded yet.</p>
              )}
            </section>
            <section className="surface admin-panel">
              <div className="section-heading">
                <h2>Recently registered users</h2>
              </div>
              <p className="subtle-label">Latest 10 accounts</p>
              <ul className="admin-list">
                {insights.recentUsers.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.name}
                      <small>{item.email}</small>
                    </span>
                    <span>
                      {displayDate(item.createdAt.slice(0, 10))}
                      <small>{item.role}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
      <section className="surface admin-panel">
        <div className="section-heading">
          <h2>Shared categories</h2>
          <button className="button primary" disabled={pending} onClick={() => edit('new')}>
            <Plus size={16} />
            Add category
          </button>
        </div>
        <p className="subtle-label">Deleted categories’ expenses move to Uncategorized.</p>
        <ul className="admin-list">
          {categories.map((item) => (
            <li key={item.id}>
              <span className="category-admin-name">
                <i style={{ background: item.color }} />
                {item.name}
              </span>
              {item.isDefault ? (
                <span className="subtle-label">Protected default</span>
              ) : (
                <span className="admin-actions">
                  <button
                    className="button subtle"
                    disabled={pending}
                    onClick={() => edit(item)}
                    aria-label={`Edit ${item.name}`}
                  >
                    Edit
                  </button>
                  <button
                    className="button subtle"
                    disabled={pending}
                    onClick={() => {
                      setMutationError('');
                      setDeleting(item);
                    }}
                    aria-label={`Delete ${item.name}`}
                  >
                    Delete
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      {editing && (
        <Modal
          title={editing === 'new' ? 'Add category' : 'Edit category'}
          onClose={() => setEditing(null)}
          pending={pending}
        >
          <form onSubmit={save} className="admin-category-form">
            <label htmlFor="category-name">
              Category name
              <input
                id="category-name"
                required
                maxLength={60}
                value={input.name}
                onChange={(event) => setInput({ ...input, name: event.target.value })}
                disabled={pending}
              />
            </label>
            <label htmlFor="category-color">
              Color
              <input
                id="category-color"
                type="color"
                value={input.color}
                onChange={(event) => setInput({ ...input, color: event.target.value })}
                disabled={pending}
              />
            </label>
            {mutationError && (
              <p className="form-error" role="alert">
                {mutationError}
              </p>
            )}
            <div className="heading-actions">
              <button
                type="button"
                className="button secondary"
                disabled={pending}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={pending}>
                {pending ? 'Saving…' : 'Save category'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title={`Delete ${deleting.name}?`}
          onClose={() => setDeleting(null)}
          pending={pending}
        >
          <p>This category will be permanently deleted. Its expenses will move to Uncategorized.</p>
          {mutationError && (
            <p className="form-error" role="alert">
              {mutationError}
            </p>
          )}
          <div className="heading-actions">
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Keep category
            </button>
            <button className="button danger" disabled={pending} onClick={() => void remove()}>
              {pending ? 'Deleting…' : 'Delete category'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
