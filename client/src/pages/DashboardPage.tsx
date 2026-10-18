import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus, ReceiptText, Wallet, TrendingUp } from 'lucide-react';
import type { Expense } from '../../../shared/contracts';
import { useAppSelector } from '../store';
import { selectMonthlySummary } from '../store/selectors';
import { money, displayMonth, displayDate } from '../lib/money';
import { MonthPicker } from '../components/MonthPicker';
import { BudgetProgress } from '../components/BudgetProgress';
import { ExpenseForm } from '../components/ExpenseForm';
import { ExpenseDetails } from '../components/ExpenseDetails';

export function DashboardPage() {
  const summary = useAppSelector(selectMonthlySummary);
  const [form, setForm] = useState<Expense | 'new' | null>(null);
  const [detail, setDetail] = useState<Expense | null>(null);
  const [message, setMessage] = useState('');
  return (
    <>
      <div className="workspace-page-heading dashboard-heading">
        <div>
          <h1>Overview</h1>
          <p>{displayMonth(summary.month)}</p>
        </div>
        <MonthPicker />
      </div>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      <div className="overview-hero">
        <section className="surface spending-hero" aria-labelledby="total-spent-title">
          <div className="hero-topline">
            <span className="currency-chip">RWF</span>
            <span className="subtle-label">{displayMonth(summary.month)}</span>
          </div>
          <div className="hero-balance">
            <h2 id="total-spent-title">Total spent</h2>
            <strong>{money(summary.spentMinor)}</strong>
            <p>
              {summary.expenseCount} {summary.expenseCount === 1 ? 'expense' : 'expenses'} this
              month
            </p>
          </div>
          <div className="hero-actions">
            <button className="button primary" onClick={() => setForm('new')}>
              <Plus size={16} />
              Add expense
            </button>
            <Link className="button secondary" to="/expenses">
              View expenses
              <ArrowUpRight size={16} />
            </Link>
            <span className="hero-arrow" aria-hidden="true">
              <ArrowUpRight size={30} strokeWidth={1.4} />
            </span>
          </div>
        </section>
        <section className="balance-hero" aria-labelledby="remaining-budget-title">
          <div className="balance-topline">
            <span className="balance-chip">
              <Wallet size={14} />
              MONTHLY BUDGET
            </span>
            <span className="balance-decoration" aria-hidden="true">
              ✦
            </span>
          </div>
          <div className="hero-balance">
            <h2 id="remaining-budget-title">Remaining budget</h2>
            <strong>
              {summary.remainingMinor === null ? 'Not set' : money(summary.remainingMinor)}
            </strong>
          </div>
          <div className="balance-details">
            <div>
              <span>Budget limit</span>
              <strong>{summary.budget ? money(summary.budget.amountMinor) : 'Not set'}</strong>
            </div>
            <div>
              <span>
                <TrendingUp size={13} />
                Highest expense
              </span>
              <strong>
                {summary.highestExpense ? money(summary.highestExpense.amountMinor) : 'None yet'}
              </strong>
              <small>{summary.highestExpense?.title || 'No expenses this month'}</small>
            </div>
          </div>
        </section>
      </div>
      <div className="overview-details">
        <BudgetProgress />
        <section className="surface category-spending">
          <div className="section-heading">
            <h2>
              <span className="section-icon">
                <ReceiptText size={16} />
              </span>
              Spending by category
            </h2>
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
                  <small>
                    {Math.round((category.amountMinor / summary.spentMinor) * 100)}% of spending
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <div className="small-empty">
              <ReceiptText size={28} />
              <p>Add an expense to see your category breakdown.</p>
            </div>
          )}
        </section>
        <section className="surface recent-expenses recent-card">
          <div className="section-heading">
            <h2>
              <span className="section-icon">
                <ReceiptText size={16} />
              </span>
              Recent expenses
            </h2>
            <Link className="icon-button" to="/expenses" aria-label="View all expenses">
              <ArrowUpRight size={17} />
            </Link>
          </div>
          {summary.recentExpenses.length ? (
            <ul className="recent-list">
              {summary.recentExpenses.map((expense) => (
                <li key={expense.id}>
                  <button onClick={() => setDetail(expense)}>
                    <span className="recent-icon">
                      <ReceiptText size={16} />
                    </span>
                    <span className="recent-description">
                      <strong>{expense.title}</strong>
                      <small>{displayDate(expense.date)}</small>
                    </span>
                    <span className="recent-amount">{money(expense.amountMinor)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="small-empty">
              <ReceiptText size={28} />
              <p>No expenses this month.</p>
              <button className="text-button" onClick={() => setForm('new')}>
                Add your first expense
              </button>
            </div>
          )}
        </section>
      </div>
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
