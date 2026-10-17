import { ArrowUpRight, ReceiptText } from 'lucide-react';
import type { Expense } from '../../../shared/contracts';
import { useAppSelector } from '../store';
import { displayDate, money, paymentLabels } from '../lib/money';
export function ExpenseTable({
  expenses,
  onSelect,
}: {
  expenses: Expense[];
  onSelect: (expense: Expense) => void;
}) {
  const categories = useAppSelector((state) => state.financial.categories);
  return (
    <div className="expense-table-wrap">
      <table className="expense-table">
        <caption className="sr-only">Expense records</caption>
        <thead>
          <tr>
            <th scope="col">Expense</th>
            <th scope="col" className="category-column">
              Category
            </th>
            <th scope="col" className="date-column">
              Date
            </th>
            <th scope="col" className="payment-column">
              Payment
            </th>
            <th scope="col" className="amount-cell">
              Amount
            </th>
            <th scope="col">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => {
            const category = categories.find((item) => item.id === expense.categoryId);
            return (
              <tr key={expense.id}>
                <td>
                  <button className="expense-title-button" onClick={() => onSelect(expense)}>
                    <span className="expense-icon" style={{ color: category?.color }}>
                      <ReceiptText size={17} />
                    </span>
                    <span className="expense-name">
                      {expense.title}
                      <small className="mobile-expense-date">{displayDate(expense.date)}</small>
                    </span>
                  </button>
                </td>
                <td className="category-column">
                  <span className="category-label">
                    <i style={{ background: category?.color }} />
                    {category?.name || 'Uncategorized'}
                  </span>
                </td>
                <td className="date-column">{displayDate(expense.date)}</td>
                <td className="payment-column">{paymentLabels[expense.paymentMethod]}</td>
                <td className="amount-cell">{money(expense.amountMinor)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${expense.title}`}
                    onClick={() => onSelect(expense)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
