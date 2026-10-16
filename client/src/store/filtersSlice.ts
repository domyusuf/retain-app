import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ExpenseSort, PaymentMethod } from '../../../shared/contracts';

export interface ExpenseFilters {
  query: string;
  categoryId: string;
  paymentMethod: PaymentMethod | '';
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  sort: ExpenseSort;
  page: number;
  pageSize: number;
  month: string;
}
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
const initialState: ExpenseFilters = {
  query: '',
  categoryId: '',
  paymentMethod: '',
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  sort: 'date_desc',
  page: 1,
  pageSize: 10,
  month: currentMonth(),
};
const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    updateFilters(
      state,
      action: PayloadAction<Partial<Omit<ExpenseFilters, 'page' | 'pageSize'>>>,
    ) {
      Object.assign(state, action.payload);
      state.page = 1;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, Math.trunc(action.payload));
    },
    resetFilters: () => ({ ...initialState, month: currentMonth() }),
  },
});
export const { updateFilters, setPage, resetFilters } = filtersSlice.actions;
export default filtersSlice.reducer;
