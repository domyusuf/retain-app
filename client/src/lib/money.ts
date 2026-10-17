export const currency = 'RWF';
export function parseAmount(value: string): number | null {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, decimal = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}
export function amountInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(/\.00$/, '');
}
export function money(minor: number): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(minor / 100);
}
export function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function displayDate(date: string): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  );
}
export function displayMonth(month: string): string {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(`${month}-01T12:00:00`),
  );
}
export const paymentLabels = {
  cash: 'Cash',
  mobile_money: 'Mobile money',
  card: 'Card',
  bank_transfer: 'Bank transfer',
} as const;
