export type Role = 'user' | 'admin';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}
export interface SignInInput {
  email: string;
  password: string;
}
export interface SignUpInput extends SignInInput {
  name: string;
}
export interface Category {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}
export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'bank_transfer';
export interface Expense {
  id: string;
  title: string;
  amountMinor: number;
  categoryId: string;
  date: string;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface Budget {
  month: string;
  amountMinor: number;
  updatedAt: string;
}
export interface ApiFailure {
  error: { code: string; message: string };
}
export type ExpenseSort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export type ExpenseInput = Pick<
  Expense,
  'title' | 'amountMinor' | 'categoryId' | 'date' | 'paymentMethod' | 'notes'
>;
export type BudgetStatus = 'unset' | 'within' | 'approaching' | 'over';
export interface CategorySpending {
  categoryId: string;
  name: string;
  color: string;
  amountMinor: number;
  count: number;
}
export interface DashboardSummary {
  month: string;
  spentMinor: number;
  budget: Budget | null;
  remainingMinor: number | null;
  budgetStatus: BudgetStatus;
  expenseCount: number;
  highestExpense: Expense | null;
  byCategory: CategorySpending[];
  recentExpenses: Expense[];
}

export type CategoryInput = Pick<Category, 'name' | 'color'>;
export interface AdminExpense extends Expense {
  ownerName: string;
  categoryName: string;
}
export interface PlatformInsights {
  month: string;
  userCount: number;
  expenseCount: number;
  expenseValueMinor: number;
  currentMonthExpenseCount: number;
  byCategory: CategorySpending[];
  mostUsed: CategorySpending[];
  leastUsed: CategorySpending[];
  recentExpenses: AdminExpense[];
  recentUsers: User[];
}
