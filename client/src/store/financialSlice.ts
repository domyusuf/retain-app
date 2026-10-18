import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { Budget, Category, Expense, ExpenseInput } from '../../../shared/contracts';
import { apiRequest } from '../lib/api';

export interface FinancialState {
  ownerId: string | null;
  expenses: Expense[];
  categories: Category[];
  budgets: Budget[];
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
  requestId: string | null;
}
const initialState: FinancialState = {
  ownerId: null,
  expenses: [],
  categories: [],
  budgets: [],
  status: 'idle',
  error: null,
  requestId: null,
};
export const loadFinancialData = createAsyncThunk(
  'financial/load',
  async (ownerId: string, { signal }) => {
    const [expenses, categories, budgets] = await Promise.all([
      apiRequest<{ expenses: Expense[] }>('/expenses/all', { signal }),
      apiRequest<{ categories: Category[] }>('/categories', { signal }),
      apiRequest<{ budgets: Budget[] }>('/budgets', { signal }),
    ]);
    return { ownerId, ...expenses, ...categories, ...budgets };
  },
);
export const saveExpense = createAsyncThunk(
  'financial/saveExpense',
  async ({ ownerId, id, input }: { ownerId: string; id?: string; input: ExpenseInput }) => {
    const { expense } = await apiRequest<{ expense: Expense }>(
      id ? `/expenses/${encodeURIComponent(id)}` : '/expenses',
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) },
    );
    return { ownerId, expense };
  },
);
export const deleteExpense = createAsyncThunk(
  'financial/deleteExpense',
  async ({ ownerId, id }: { ownerId: string; id: string }) => {
    await apiRequest<void>(`/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { ownerId, id };
  },
);
export const saveBudget = createAsyncThunk(
  'financial/saveBudget',
  async ({
    ownerId,
    month,
    amountMinor,
  }: {
    ownerId: string;
    month: string;
    amountMinor: number;
  }) => {
    const { budget } = await apiRequest<{ budget: Budget }>(`/budgets/${month}`, {
      method: 'PUT',
      body: JSON.stringify({ amountMinor }),
    });
    return { ownerId, budget };
  },
);
export const refreshCategories = createAsyncThunk(
  'financial/refreshCategories',
  async (ownerId: string) => {
    const [categories, expenses] = await Promise.all([
      apiRequest<{ categories: Category[] }>('/categories'),
      apiRequest<{ expenses: Expense[] }>('/expenses/all'),
    ]);
    return { ownerId, ...categories, ...expenses };
  },
);
const slice = createSlice({
  name: 'financial',
  initialState,
  reducers: {
    clearFinancialData: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(refreshCategories.fulfilled, (state, action) => {
      if (state.ownerId !== action.payload.ownerId) return;
      state.categories = action.payload.categories;
      state.expenses = action.payload.expenses;
    });
    builder.addCase(loadFinancialData.pending, (state, action) => {
      if (state.ownerId !== action.meta.arg) {
        state.expenses = [];
        state.categories = [];
        state.budgets = [];
      }
      state.ownerId = action.meta.arg;
      state.requestId = action.meta.requestId;
      state.status = 'loading';
      state.error = null;
    });
    builder.addCase(loadFinancialData.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId || state.ownerId !== action.payload.ownerId)
        return;
      state.expenses = action.payload.expenses;
      state.categories = action.payload.categories;
      state.budgets = action.payload.budgets;
      state.status = 'ready';
      state.requestId = null;
    });
    builder.addCase(loadFinancialData.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.status = action.meta.aborted ? 'idle' : 'failed';
      state.error = action.error.message || 'Your data could not be loaded.';
      state.requestId = null;
    });
    builder.addCase(saveExpense.fulfilled, (state, action) => {
      if (state.ownerId !== action.payload.ownerId) return;
      const index = state.expenses.findIndex((item) => item.id === action.payload.expense.id);
      if (index < 0) state.expenses.push(action.payload.expense);
      else state.expenses[index] = action.payload.expense;
    });
    builder.addCase(deleteExpense.fulfilled, (state, action) => {
      if (state.ownerId === action.payload.ownerId)
        state.expenses = state.expenses.filter((item) => item.id !== action.payload.id);
    });
    builder.addCase(saveBudget.fulfilled, (state, action) => {
      if (state.ownerId !== action.payload.ownerId) return;
      const index = state.budgets.findIndex((item) => item.month === action.payload.budget.month);
      if (index < 0) state.budgets.push(action.payload.budget);
      else state.budgets[index] = action.payload.budget;
    });
  },
});
export const { clearFinancialData } = slice.actions;
export default slice.reducer;
