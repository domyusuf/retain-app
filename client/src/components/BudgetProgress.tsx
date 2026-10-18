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
        <h2 id="budget-progress-heading">Monthly budget</h2>
        <span className={`status-badge ${summary.budgetStatus}`}>
          {labels[summary.budgetStatus]}
        </span>
      </div>
      {summary.budget ? (
        <>
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
          <div
            className={`budget-meter ${summary.budgetStatus}`}
            role="progressbar"
            aria-label="Monthly budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(summary.progress)}
            aria-valuetext={`${Math.round((summary.spentMinor / summary.budget.amountMinor) * 100)}% of budget spent`}
          >
            <span style={{ width: `${summary.progress}%` }} />
          </div>
          <p className="budget-hint">
            {summary.remainingMinor! < 0
              ? `${money(-summary.remainingMinor!)} over budget.`
              : `${money(summary.remainingMinor!)} remaining.`}
          </p>
        </>
      ) : (
        <p className="budget-hint">Set a monthly budget to track your remaining balance.</p>
      )}
      {showLink && (
        <Link className="text-link" to="/budget">
          {summary.budget ? 'Manage budget' : 'Set a monthly budget'} →
        </Link>
      )}
    </section>
  );
}
