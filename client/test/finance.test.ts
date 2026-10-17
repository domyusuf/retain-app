import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Expense } from '../../shared/contracts';
import type { RootState } from '../src/store';
import filtersReducer, {
  updateFilters,
  setPage,
  clearExpenseFilters,
} from '../src/store/filtersSlice';
import financialReducer, {
  clearFinancialData,
  loadFinancialData,
  saveExpense,
} from '../src/store/financialSlice';
import {
  selectFilteredExpenses,
  selectExpensePage,
  selectMonthlySummary,
  selectFilterError,
} from '../src/store/selectors';
import { parseAmount } from '../src/lib/money';

const expenses: Expense[] = Array.from({ length: 13 }, (_, i) => ({
  id: String(i),
  title: i === 0 ? 'Lunch at school' : `Expense ${i}`,
  notes: i === 0 ? 'With a friend' : '',
  amountMinor: (i + 1) * 10000,
  categoryId: i % 2 ? 'transport' : 'food',
  paymentMethod: i % 2 ? 'mobile_money' : 'cash',
  date: i === 12 ? '2026-09-30' : `2026-10-${String(i + 1).padStart(2, '0')}`,
  createdAt: '2026-10-17T10:00:00Z',
  updatedAt: '2026-10-17T10:00:00Z',
}));
function state(): RootState {
  return {
    filters: { ...filtersReducer(undefined, { type: 'init' }), month: '2026-10' },
    financial: {
      ownerId: 'alice',
      expenses,
      categories: [
        { id: 'food', name: 'Food', color: '#aa9911', isDefault: false },
        { id: 'transport', name: 'Transport', color: '#223344', isDefault: false },
      ],
      budgets: [{ month: '2026-10', amountMinor: 1000000, updatedAt: '2026-10-17T10:00:00Z' }],
      status: 'ready',
      error: null,
      requestId: null,
    },
  };
}

test('money parsing preserves exact minor units and rejects malformed or excessive amounts', () => {
  assert.equal(parseAmount('0.10'), 10);
  assert.equal(parseAmount('1234.56'), 123456);
  assert.equal(parseAmount('4500'), 450000);
  for (const input of ['-1', '1.234', '1e6', 'NaN', '1,000', '', '1000000000'])
    assert.equal(parseAmount(input), null);
});
test('search is case insensitive, covers notes and combines with every filter in Redux', () => {
  let s = state();
  s = {
    ...s,
    filters: filtersReducer(
      s.filters,
      updateFilters({
        query: 'FRIEND',
        categoryId: 'food',
        paymentMethod: 'cash',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        minAmount: '100',
        maxAmount: '100',
      }),
    ),
  };
  assert.deepEqual(
    selectFilteredExpenses(s).map((e) => e.id),
    ['0'],
  );
  s = { ...s, filters: filtersReducer(s.filters, updateFilters({ categoryId: 'transport' })) };
  assert.equal(selectFilteredExpenses(s).length, 0);
});
test('all four sort modes are correct without changing original records', () => {
  let s = state();
  const original = expenses.map((e) => e.id);
  for (const [sort, first] of [
    ['amount_asc', '0'],
    ['amount_desc', '12'],
    ['date_asc', '12'],
    ['date_desc', '11'],
  ] as const) {
    s = { ...s, filters: filtersReducer(s.filters, updateFilters({ sort })) };
    assert.equal(selectFilteredExpenses(s)[0].id, first);
  }
  assert.deepEqual(
    expenses.map((e) => e.id),
    original,
  );
});
test('pagination clamps after deletion and changing filters resets the requested page', () => {
  let s = state();
  s = { ...s, filters: filtersReducer(s.filters, setPage(2)) };
  assert.equal(selectExpensePage(s).expenses.length, 3);
  assert.equal(selectExpensePage(s).totalPages, 2);
  const changed = { ...s, financial: { ...s.financial, expenses: expenses.slice(0, 8) } };
  assert.equal(selectExpensePage(changed).page, 1);
  assert.equal(selectExpensePage(changed).expenses.length, 8);
  s = { ...s, filters: filtersReducer(s.filters, updateFilters({ query: 'Lunch' })) };
  assert.equal(s.filters.page, 1);
  assert.equal(selectExpensePage(s).total, 1);
});
test('invalid amount/date ranges show a filter error rather than misleading results', () => {
  let s = state();
  s = {
    ...s,
    filters: filtersReducer(s.filters, updateFilters({ minAmount: '100', maxAmount: '10' })),
  };
  assert.ok(selectFilterError(s));
  assert.equal(selectFilteredExpenses(s).length, 0);
  s = { ...s, filters: filtersReducer(s.filters, clearExpenseFilters()) };
  s = {
    ...s,
    filters: filtersReducer(
      s.filters,
      updateFilters({ startDate: '2026-10-10', endDate: '2026-10-01' }),
    ),
  };
  assert.ok(selectFilterError(s));
});
test('monthly summaries ignore expense list search and pagination, include category totals and recent items', () => {
  let s = state();
  const initial = selectMonthlySummary(s);
  assert.equal(initial.spentMinor, 780000);
  assert.equal(initial.expenseCount, 12);
  assert.equal(initial.remainingMinor, 220000);
  assert.equal(initial.highestExpense?.id, '11');
  assert.equal(
    initial.byCategory.reduce((sum, c) => sum + c.amountMinor, 0),
    initial.spentMinor,
  );
  assert.equal(initial.recentExpenses.length, 5);
  s = { ...s, filters: filtersReducer(s.filters, updateFilters({ query: 'No match' })) };
  s = { ...s, filters: filtersReducer(s.filters, setPage(100)) };
  assert.equal(selectExpensePage(s).total, 0);
  assert.equal(selectMonthlySummary(s).spentMinor, 780000);
  s = { ...s, filters: filtersReducer(s.filters, updateFilters({ month: '2026-09' })) };
  assert.equal(selectMonthlySummary(s).spentMinor, 130000);
  assert.equal(selectMonthlySummary(s).budgetStatus, 'unset');
});
test('budget statuses distinguish within, approaching, over and unset without hiding overspend', () => {
  let s = state();
  assert.equal(selectMonthlySummary(s).budgetStatus, 'within');
  s = {
    ...s,
    financial: { ...s.financial, budgets: [{ ...s.financial.budgets[0], amountMinor: 900000 }] },
  };
  assert.equal(selectMonthlySummary(s).budgetStatus, 'approaching');
  s = {
    ...s,
    financial: { ...s.financial, budgets: [{ ...s.financial.budgets[0], amountMinor: 500000 }] },
  };
  assert.equal(selectMonthlySummary(s).budgetStatus, 'over');
  assert.equal(selectMonthlySummary(s).remainingMinor, -280000);
  s = { ...s, financial: { ...s.financial, budgets: [] } };
  assert.equal(selectMonthlySummary(s).budgetStatus, 'unset');
  assert.equal(selectMonthlySummary(s).remainingMinor, null);
});
test('late loads and mutations cannot put another account data into the current store', () => {
  let s = financialReducer(undefined, loadFinancialData.pending('alice-request', 'alice'));
  s = financialReducer(s, clearFinancialData());
  s = financialReducer(s, loadFinancialData.pending('bob-request', 'bob'));
  const before = s;
  s = financialReducer(
    s,
    loadFinancialData.fulfilled(
      { ownerId: 'alice', expenses, categories: [], budgets: [] },
      'alice-request',
      'alice',
    ),
  );
  assert.equal(s, before);
  assert.equal(s.ownerId, 'bob');
  assert.equal(s.expenses.length, 0);
  s = financialReducer(
    s,
    saveExpense.fulfilled({ ownerId: 'alice', expense: expenses[0] }, 'save', {
      ownerId: 'alice',
      input: expenses[0],
    }),
  );
  assert.equal(s.expenses.length, 0);
  s = financialReducer(s, clearFinancialData());
  assert.equal(s.ownerId, null);
  assert.equal(s.expenses.length, 0);
  assert.equal(s.budgets.length, 0);
});
