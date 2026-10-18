import type { CSSProperties } from 'react';
import { Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../store';
import { selectMonthlySummary } from '../store/selectors';
import { money } from '../lib/money';
export function BudgetProgress({ showLink = true }: { showLink?: boolean }) {
  const summary = useAppSelector(selectMonthlySummary);
  const labels = {
    unset: 'No budget yet',
    within: 'Within budget',
    approaching: 'Approaching budget',
    over: 'Over budget',
  };
  return (
    <section className="surface budget-progress" aria-labelledby="budget-progress-heading">
      <div className="section-heading">
        <h2 id="budget-progress-heading">
          <span className="section-icon">
            <Wallet size={16} />
          </span>
          Monthly budget
        </h2>
        <span className={`status-badge ${summary.budgetStatus}`}>
          {labels[summary.budgetStatus]}
        </span>
      </div>
      {summary.budget ? (
        <>
          <div
            className={`budget-ring ${summary.budgetStatus}`}
            style={{ '--budget-progress': `${summary.progress}%` } as CSSProperties}
            role="progressbar"
            aria-label="Monthly budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(summary.progress)}
            aria-valuetext={`${Math.round((summary.spentMinor / summary.budget.amountMinor) * 100)}% of budget spent`}
          >
            <div>
              <strong>
                {Math.round((summary.spentMinor / summary.budget.amountMinor) * 100)}
                <span>%</span>
              </strong>
              <small>of budget spent</small>
            </div>
          </div>
          <div className="budget-amounts">
            <p>
              <span>Spent</span>
              <strong>{money(summary.spentMinor)}</strong>
            </p>
            <p>
              <span>Budget</span>
              <strong>{money(summary.budget.amountMinor)}</strong>
            </p>
          </div>
          <p className="budget-hint">
            {summary.remainingMinor! < 0
              ? `${money(-summary.remainingMinor!)} over budget.`
              : `${money(summary.remainingMinor!)} remaining.`}
          </p>
        </>
      ) : (
        <div className="budget-unset">
          <div className="budget-ring unset" aria-hidden="true">
            <div>
              <Wallet size={30} />
              <small>No budget yet</small>
            </div>
          </div>
          <p className="budget-hint">Set a monthly budget to track your remaining balance.</p>
        </div>
      )}
      {showLink && (
        <Link className="text-link" to="/budget">
          {summary.budget ? 'Manage budget' : 'Set a monthly budget'} →
        </Link>
      )}
    </section>
  );
}
