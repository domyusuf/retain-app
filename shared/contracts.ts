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
