import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import type { ExpenseSort, PaymentMethod } from '../../../shared/contracts';
import { useAppDispatch, useAppSelector } from '../store';
import { clearExpenseFilters, updateFilters } from '../store/filtersSlice';
import { selectFilterError, selectFilters } from '../store/selectors';
import { paymentLabels } from '../lib/money';
export function ExpenseFilters() {
  const filters = useAppSelector(selectFilters);
  const categories = useAppSelector((state) => state.financial.categories);
  const error = useAppSelector(selectFilterError);
  const dispatch = useAppDispatch();
  return (
    <section className="filter-panel" aria-label="Filter expenses">
      <div className="filter-top">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search expenses"
            placeholder="Search expenses or notes…"
            maxLength={200}
            value={filters.query}
            onChange={(e) => dispatch(updateFilters({ query: e.target.value }))}
          />
        </div>
        <label className="sort-field">
          <span>Sort by</span>
          <span className="sort-select">
            <select
              aria-label="Sort expenses"
              value={filters.sort}
              onChange={(e) => dispatch(updateFilters({ sort: e.target.value as ExpenseSort }))}
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="amount_desc">Amount: high to low</option>
              <option value="amount_asc">Amount: low to high</option>
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>
      </div>
      <details className="filter-details">
        <summary>
          <SlidersHorizontal size={15} />
          Filter expenses
        </summary>
        <div className="filter-grid">
          <label className="field">
            <span>Category</span>
            <select
              aria-label="Filter by category"
              value={filters.categoryId}
              onChange={(e) => dispatch(updateFilters({ categoryId: e.target.value }))}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Payment method</span>
            <select
              aria-label="Filter by payment method"
              value={filters.paymentMethod}
              onChange={(e) =>
                dispatch(updateFilters({ paymentMethod: e.target.value as PaymentMethod | '' }))
              }
            >
              <option value="">All methods</option>
              {Object.entries(paymentLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>From</span>
            <input
              type="date"
              aria-label="From date"
              value={filters.startDate}
              onInput={(e) => dispatch(updateFilters({ startDate: e.currentTarget.value }))}
              onChange={(e) => dispatch(updateFilters({ startDate: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              aria-label="To date"
              value={filters.endDate}
              onInput={(e) => dispatch(updateFilters({ endDate: e.currentTarget.value }))}
              onChange={(e) => dispatch(updateFilters({ endDate: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Min amount (RWF)</span>
            <input
              inputMode="decimal"
              aria-label="Minimum amount"
              placeholder="0"
              value={filters.minAmount}
              onChange={(e) => dispatch(updateFilters({ minAmount: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Max amount (RWF)</span>
            <input
              inputMode="decimal"
              aria-label="Maximum amount"
              placeholder="No limit"
              value={filters.maxAmount}
              onChange={(e) => dispatch(updateFilters({ maxAmount: e.target.value }))}
            />
          </label>
        </div>
      </details>
      <div className="filter-bottom">
        {error && (
          <p className="filter-error" role="alert">
            {error}
          </p>
        )}
        <button className="text-button" onClick={() => dispatch(clearExpenseFilters())}>
          Clear filters
        </button>
      </div>
    </section>
  );
}
