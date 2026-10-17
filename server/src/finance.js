import { Router } from 'express';
import { z } from 'zod';
import { newId } from './auth.js';

const maxAmount = 99_999_999_999;
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
const dateSchema = z.string().refine(validDate, 'Choose a valid calendar date.');
const monthSchema = z
  .string()
  .regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/, 'Choose a valid month.');
const paymentSchema = z.enum(['cash', 'mobile_money', 'card', 'bank_transfer']);
const amountSchema = z.number().int().positive().max(maxAmount);
const expenseSchema = z
  .object({
    title: z.string().trim().min(1, 'Add a title for this expense.').max(120),
    amountMinor: amountSchema,
    categoryId: z.string().min(1).max(100),
    date: dateSchema,
    paymentMethod: paymentSchema,
    notes: z.string().trim().max(2000).default(''),
  })
  .strict();
const querySchema = z
  .object({
    query: z.string().max(200).optional(),
    categoryId: z.string().max(100).optional(),
    paymentMethod: paymentSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    month: monthSchema.optional(),
    minAmountMinor: z.coerce.number().int().nonnegative().max(maxAmount).optional(),
    maxAmountMinor: z.coerce.number().int().nonnegative().max(maxAmount).optional(),
    sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc']).default('date_desc'),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict()
  .refine(
    (q) => !q.startDate || !q.endDate || q.startDate <= q.endDate,
    'The start date must be on or before the end date.',
  )
  .refine(
    (q) =>
      q.minAmountMinor === undefined ||
      q.maxAmountMinor === undefined ||
      q.minAmountMinor <= q.maxAmountMinor,
    'The minimum amount must not exceed the maximum.',
  );
export function expenseFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    amountMinor: row.amount_minor,
    categoryId: row.category_id,
    date: row.expense_date,
    paymentMethod: row.payment_method,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function budgetFromRow(row) {
  return row
    ? { month: row.month, amountMinor: row.amount_minor, updatedAt: row.updated_at }
    : null;
}
export function financeRouter(db) {
  const router = Router();
  router.get('/expenses/all', (req, res) => {
    const expenses = db
      .prepare(
        'SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC, created_at DESC, id DESC',
      )
      .all(req.user.id);
    res.json({ expenses: expenses.map(expenseFromRow) });
  });
  router.get('/expenses', (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return invalid(res, parsed.error);
    const q = parsed.data;
    const clauses = ['user_id = ?'];
    const args = [req.user.id];
    const add = (clause, value) => {
      clauses.push(clause);
      args.push(value);
    };
    if (q.query) add("instr(lower(title || ' ' || notes), lower(?)) > 0", q.query.trim());
    if (q.categoryId) add('category_id = ?', q.categoryId);
    if (q.paymentMethod) add('payment_method = ?', q.paymentMethod);
    if (q.month) add('substr(expense_date, 1, 7) = ?', q.month);
    if (q.startDate) add('expense_date >= ?', q.startDate);
    if (q.endDate) add('expense_date <= ?', q.endDate);
    if (q.minAmountMinor !== undefined) add('amount_minor >= ?', q.minAmountMinor);
    if (q.maxAmountMinor !== undefined) add('amount_minor <= ?', q.maxAmountMinor);
    const where = clauses.join(' AND ');
    const orders = {
      date_desc: 'expense_date DESC',
      date_asc: 'expense_date ASC',
      amount_desc: 'amount_minor DESC',
      amount_asc: 'amount_minor ASC',
    };
    const total = db
      .prepare(`SELECT count(*) AS total FROM expenses WHERE ${where}`)
      .get(...args).total;
    const expenses = db
      .prepare(
        `SELECT * FROM expenses WHERE ${where} ORDER BY ${orders[q.sort]}, created_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, q.pageSize, (q.page - 1) * q.pageSize);
    res.json({
      expenses: expenses.map(expenseFromRow),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    });
  });
  router.post('/expenses', (req, res) => {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const item = parsed.data;
    if (!categoryExists(db, item.categoryId)) return missingCategory(res);
    const id = newId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO expenses (id, user_id, category_id, title, amount_minor, expense_date, payment_method, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      req.user.id,
      item.categoryId,
      item.title,
      item.amountMinor,
      item.date,
      item.paymentMethod,
      item.notes,
      now,
      now,
    );
    res.status(201).json({
      expense: expenseFromRow(
        db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(id, req.user.id),
      ),
    });
  });
  router.get('/expenses/:id', (req, res) => {
    const item = db
      .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!item) return notFound(res);
    res.json({ expense: expenseFromRow(item) });
  });
  router.put('/expenses/:id', (req, res) => {
    if (
      !db
        .prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.user.id)
    )
      return notFound(res);
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const item = parsed.data;
    if (!categoryExists(db, item.categoryId)) return missingCategory(res);
    db.prepare(
      'UPDATE expenses SET category_id = ?, title = ?, amount_minor = ?, expense_date = ?, payment_method = ?, notes = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    ).run(
      item.categoryId,
      item.title,
      item.amountMinor,
      item.date,
      item.paymentMethod,
      item.notes,
      new Date().toISOString(),
      req.params.id,
      req.user.id,
    );
    res.json({
      expense: expenseFromRow(
        db
          .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
          .get(req.params.id, req.user.id),
      ),
    });
  });
  router.delete('/expenses/:id', (req, res) => {
    const result = db
      .prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    if (!result.changes) return notFound(res);
    res.status(204).end();
  });
  router.get('/budgets', (req, res) => {
    res.json({
      budgets: db
        .prepare('SELECT * FROM budgets WHERE user_id = ? ORDER BY month DESC')
        .all(req.user.id)
        .map(budgetFromRow),
    });
  });
  router.get('/budgets/:month', (req, res) => {
    const month = monthSchema.safeParse(req.params.month);
    if (!month.success) return invalid(res, month.error);
    res.json({
      budget: budgetFromRow(
        db
          .prepare('SELECT * FROM budgets WHERE user_id = ? AND month = ?')
          .get(req.user.id, month.data),
      ),
    });
  });
  router.put('/budgets/:month', (req, res) => {
    const month = monthSchema.safeParse(req.params.month);
    const parsed = z.object({ amountMinor: amountSchema }).strict().safeParse(req.body);
    if (!month.success) return invalid(res, month.error);
    if (!parsed.success) return invalid(res, parsed.error);
    db.prepare(
      'INSERT INTO budgets (id, user_id, month, amount_minor, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, month) DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = excluded.updated_at',
    ).run(newId(), req.user.id, month.data, parsed.data.amountMinor, new Date().toISOString());
    res.json({
      budget: budgetFromRow(
        db
          .prepare('SELECT * FROM budgets WHERE user_id = ? AND month = ?')
          .get(req.user.id, month.data),
      ),
    });
  });
  router.get('/dashboard', (req, res) => {
    const parsed = z.object({ month: monthSchema }).strict().safeParse(req.query);
    if (!parsed.success) return invalid(res, parsed.error);
    const expenses = db
      .prepare(
        'SELECT * FROM expenses WHERE user_id = ? AND substr(expense_date, 1, 7) = ? ORDER BY expense_date DESC, created_at DESC, id DESC',
      )
      .all(req.user.id, parsed.data.month);
    const spentMinor = expenses.reduce((sum, item) => sum + item.amount_minor, 0);
    const budget = budgetFromRow(
      db
        .prepare('SELECT * FROM budgets WHERE user_id = ? AND month = ?')
        .get(req.user.id, parsed.data.month),
    );
    const byCategory = db
      .prepare(
        'SELECT categories.id AS categoryId, categories.name, categories.color, sum(expenses.amount_minor) AS amountMinor, count(*) AS count FROM expenses JOIN categories ON categories.id = expenses.category_id WHERE expenses.user_id = ? AND substr(expense_date, 1, 7) = ? GROUP BY categories.id ORDER BY amountMinor DESC, categories.name',
      )
      .all(req.user.id, parsed.data.month);
    const highest = expenses.reduce(
      (best, item) => (!best || item.amount_minor > best.amount_minor ? item : best),
      null,
    );
    res.json({
      month: parsed.data.month,
      spentMinor,
      budget,
      remainingMinor: budget ? budget.amountMinor - spentMinor : null,
      budgetStatus: !budget
        ? 'unset'
        : spentMinor > budget.amountMinor
          ? 'over'
          : spentMinor >= budget.amountMinor * 0.8
            ? 'approaching'
            : 'within',
      expenseCount: expenses.length,
      highestExpense: highest ? expenseFromRow(highest) : null,
      byCategory,
      recentExpenses: expenses.slice(0, 5).map(expenseFromRow),
    });
  });
  return router;
}
function invalid(res, error) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: error.issues[0]?.message || 'Please check your entries.',
    },
  });
}
function categoryExists(db, id) {
  return Boolean(db.prepare('SELECT id FROM categories WHERE id = ?').get(id));
}
function missingCategory(res) {
  return res
    .status(400)
    .json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Choose an available category.' } });
}
function notFound(res) {
  return res
    .status(404)
    .json({ error: { code: 'EXPENSE_NOT_FOUND', message: 'This expense was not found.' } });
}
