import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, Plus, ReceiptText, Wallet, TrendingUp } from 'lucide-react';
import type { Expense } from '../../../shared/contracts';
import { useAuth } from '../auth/AuthContext';
import { useAppSelector } from '../store';
import { selectMonthlySummary } from '../store/selectors';
import { money, displayMonth } from '../lib/money';
import { MonthPicker } from '../components/MonthPicker';
import { BudgetProgress } from '../components/BudgetProgress';
import { ExpenseTable } from '../components/ExpenseTable';
import { ExpenseForm } from '../components/ExpenseForm';
import { ExpenseDetails } from '../components/ExpenseDetails';

export function DashboardPage() {
  const { user } = useAuth();
  const summary = useAppSelector(selectMonthlySummary);
  const [form, setForm] = useState<Expense | 'new' | null>(null);
  const [detail, setDetail] = useState<Expense | null>(null);
  const [message, setMessage] = useState('');
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <p className="eyebrow muted">A LITTLE CLARITY, EVERY DAY</p>
          <h1>
            Your money at a glance<span className="accent-dot">.</span>
          </h1>
          <p>
            Welcome back, {user?.name.split(' ')[0]}. Here’s how {displayMonth(summary.month)} is
            looking.
          </p>
        </div>
        <div className="heading-actions">
          <MonthPicker />
          <button className="button primary" onClick={() => setForm('new')}>
            <Plus size={17} />
            Add expense
          </button>
        </div>
      </div>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      <div className="stat-grid">
        <section className="stat-card stat-featured">
          <div className="stat-label">
            Total spent
            <ArrowDownLeft size={18} />
          </div>
          <strong>{money(summary.spentMinor)}</strong>
          <p>
            {summary.expenseCount} {summary.expenseCount === 1 ? 'expense' : 'expenses'} this month
          </p>
        </section>
        <section className="stat-card">
          <div className="stat-label">
            Remaining budget
            <Wallet size={18} />
          </div>
          <strong>
            {summary.remainingMinor === null ? 'Not set' : money(summary.remainingMinor)}
          </strong>
          <p>
            {summary.budget
              ? 'Your budget minus this month’s spending'
              : 'Set a budget to give your month a plan'}
          </p>
        </section>
        <section className="stat-card">
          <div className="stat-label">
            Highest expense
            <TrendingUp size={18} />
          </div>
          <strong>
            {summary.highestExpense ? money(summary.highestExpense.amountMinor) : '—'}
          </strong>
          <p>{summary.highestExpense?.title || 'Your expenses will appear here'}</p>
        </section>
      </div>
      <div className="dashboard-grid">
        <BudgetProgress />
        <section className="surface category-spending">
          <div className="section-heading">
            <h2>Spending by category</h2>
            <span className="subtle-label">{displayMonth(summary.month)}</span>
          </div>
          {summary.byCategory.length ? (
            <div className="category-bars">
              {summary.byCategory.map((category) => (
                <div className="category-spend" key={category.categoryId}>
                  <div>
                    <span>
                      <i style={{ background: category.color }} />
                      {category.name}
                    </span>
                    <strong>{money(category.amountMinor)}</strong>
                  </div>
                  <div className="category-track">
                    <span
                      style={{
                        width: `${(category.amountMinor / summary.spentMinor) * 100}%`,
                        background: category.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small-empty">
              <ReceiptText size={26} />
              <p>Add an expense to see your category breakdown.</p>
            </div>
          )}
        </section>
      </div>
      <section className="surface recent-expenses">
        <div className="section-heading">
          <h2>Recent expenses</h2>
          <Link className="text-link" to="/expenses">
            View all expenses →
          </Link>
        </div>
        {summary.recentExpenses.length ? (
          <ExpenseTable expenses={summary.recentExpenses} onSelect={setDetail} />
        ) : (
          <div className="empty-state compact">
            <ReceiptText size={29} />
            <h3>A fresh page for this month.</h3>
            <p>No expenses recorded in {displayMonth(summary.month)}.</p>
          </div>
        )}
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
            setMessage('Expense deleted. Your totals have been updated.');
          }}
        />
      )}
      {form && (
        <ExpenseForm expense={form === 'new' ? undefined : form} onClose={() => setForm(null)} />
      )}
    </>
  );
}
