import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './index';
import type { BudgetStatus, CategorySpending, Expense } from '../../../shared/contracts';
import { parseAmount } from '../lib/money.ts';

const selectExpenses = (state: RootState) => state.financial.expenses;
export const selectFilters = (state: RootState) => state.filters;
const selectCategories = (state: RootState) => state.financial.categories;
const selectBudgets = (state: RootState) => state.financial.budgets;
export const selectFilterError = createSelector([selectFilters], (filters) => {
  if (filters.minAmount && parseAmount(filters.minAmount) === null)
    return 'Enter a valid minimum amount with up to two decimal places.';
  if (filters.maxAmount && parseAmount(filters.maxAmount) === null)
    return 'Enter a valid maximum amount with up to two decimal places.';
  if (
    filters.minAmount &&
    filters.maxAmount &&
    parseAmount(filters.minAmount)! > parseAmount(filters.maxAmount)!
  )
    return 'The minimum amount must not exceed the maximum.';
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate)
    return 'The start date must be on or before the end date.';
  return null;
});
function newest(a: Expense, b: Expense) {
  return (
    b.date.localeCompare(a.date) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}
export const selectFilteredExpenses = createSelector(
  [selectExpenses, selectFilters, selectFilterError],
  (expenses, filters, error) => {
    if (error) return [];
    const query = filters.query.trim().toLocaleLowerCase();
    const min = filters.minAmount ? parseAmount(filters.minAmount) : null;
    const max = filters.maxAmount ? parseAmount(filters.maxAmount) : null;
    return expenses
      .filter(
        (item) =>
          (!query || `${item.title} ${item.notes}`.toLocaleLowerCase().includes(query)) &&
          (!filters.categoryId || item.categoryId === filters.categoryId) &&
          (!filters.paymentMethod || item.paymentMethod === filters.paymentMethod) &&
          (!filters.startDate || item.date >= filters.startDate) &&
          (!filters.endDate || item.date <= filters.endDate) &&
          (min === null || item.amountMinor >= min) &&
          (max === null || item.amountMinor <= max),
      )
      .sort((a, b) => {
        if (filters.sort === 'amount_asc') return a.amountMinor - b.amountMinor || newest(a, b);
        if (filters.sort === 'amount_desc') return b.amountMinor - a.amountMinor || newest(a, b);
        if (filters.sort === 'date_asc') return a.date.localeCompare(b.date) || newest(a, b);
        return newest(a, b);
      });
  },
);
export const selectExpensePage = createSelector(
  [selectFilteredExpenses, selectFilters],
  (expenses, filters) => {
    const totalPages = Math.max(1, Math.ceil(expenses.length / filters.pageSize));
    const page = Math.min(filters.page, totalPages);
    const start = (page - 1) * filters.pageSize;
    return {
      expenses: expenses.slice(start, start + filters.pageSize),
      page,
      totalPages,
      total: expenses.length,
      start: expenses.length ? start + 1 : 0,
      end: Math.min(start + filters.pageSize, expenses.length),
    };
  },
);
export const selectMonth = (state: RootState) => state.filters.month;
export const selectMonthlyExpenses = createSelector(
  [selectExpenses, selectMonth],
  (expenses, month) => expenses.filter((item) => item.date.startsWith(`${month}-`)).sort(newest),
);
export const selectMonthlySummary = createSelector(
  [selectMonthlyExpenses, selectBudgets, selectCategories, selectMonth],
  (expenses, budgets, categories, month) => {
    const budget = budgets.find((item) => item.month === month) || null;
    const spentMinor = expenses.reduce((sum, item) => sum + item.amountMinor, 0);
    const highestExpense = expenses.reduce<Expense | null>(
      (best, item) => (!best || item.amountMinor > best.amountMinor ? item : best),
      null,
    );
    const groups = new Map<string, CategorySpending>();
    expenses.forEach((item) => {
      const current = groups.get(item.categoryId);
      if (current) {
        current.amountMinor += item.amountMinor;
        current.count++;
      } else {
        const category = categories.find((c) => c.id === item.categoryId);
        groups.set(item.categoryId, {
          categoryId: item.categoryId,
          name: category?.name || 'Uncategorized',
          color: category?.color || '#6b7280',
          amountMinor: item.amountMinor,
          count: 1,
        });
      }
    });
    const budgetStatus: BudgetStatus = !budget
      ? 'unset'
      : spentMinor > budget.amountMinor
        ? 'over'
        : spentMinor >= budget.amountMinor * 0.8
          ? 'approaching'
          : 'within';
    return {
      month,
      expenses,
      budget,
      spentMinor,
      remainingMinor: budget ? budget.amountMinor - spentMinor : null,
      highestExpense,
      byCategory: [...groups.values()].sort(
        (a, b) => b.amountMinor - a.amountMinor || a.name.localeCompare(b.name),
      ),
      budgetStatus,
      expenseCount: expenses.length,
      recentExpenses: expenses.slice(0, 5),
      progress: budget ? Math.min(100, (spentMinor / budget.amountMinor) * 100) : 0,
    };
  },
);
