import { Router } from 'express';
import { z } from 'zod';
import { newId, publicUser } from './auth.js';
import { expenseFromRow } from './finance.js';

const categorySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a valid category color.'),
  })
  .strict();
const category = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  isDefault: Boolean(row.is_default),
});
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
export function managementRouter(db) {
  const router = Router();
  const find = (id) => db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  function save(req, res, updating) {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    const existing = updating ? find(req.params.id) : null;
    if (updating && !existing) return fail(res, 404, 'NOT_FOUND', 'Category not found.');
    if (existing?.is_default)
      return fail(res, 409, 'DEFAULT_CATEGORY', 'Uncategorized is the protected default category.');
    const { name, color } = parsed.data;
    const duplicate = db
      .prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE')
      .get(name);
    if (duplicate && duplicate.id !== existing?.id)
      return fail(res, 409, 'CATEGORY_EXISTS', 'A category with this name already exists.');
    const id = existing?.id || newId();
    if (updating)
      db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(name, color, id);
    else
      db.prepare(
        'INSERT INTO categories (id, name, color, is_default, created_at) VALUES (?, ?, ?, 0, ?)',
      ).run(id, name, color, new Date().toISOString());
    return res.status(updating ? 200 : 201).json({ category: category(find(id)) });
  }
  router.post('/categories', (req, res) => save(req, res, false));
  router.put('/categories/:id', (req, res) => save(req, res, true));
  router.delete('/categories/:id', (req, res) => {
    const existing = find(req.params.id);
    if (!existing) return fail(res, 404, 'NOT_FOUND', 'Category not found.');
    if (existing.is_default)
      return fail(res, 409, 'DEFAULT_CATEGORY', 'Uncategorized cannot be deleted.');
    db.exec('BEGIN IMMEDIATE');
    try {
      const fallback = db.prepare('SELECT id FROM categories WHERE is_default = 1').get();
      if (!fallback) throw new Error('Default category is missing');
      const changed = db
        .prepare('UPDATE expenses SET category_id = ?, updated_at = ? WHERE category_id = ?')
        .run(fallback.id, new Date().toISOString(), existing.id);
      db.prepare('DELETE FROM categories WHERE id = ?').run(existing.id);
      db.exec('COMMIT');
      res.json({ reassignedCount: Number(changed.changes), defaultCategoryId: fallback.id });
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
  router.get('/insights', (req, res) => {
    // Kigali's UTC+02:00 has no daylight saving; use the platform's reporting month.
    const month = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const totals = db
      .prepare(
        'SELECT COUNT(*) AS expenseCount, COALESCE(SUM(amount_minor), 0) AS expenseValueMinor FROM expenses',
      )
      .get();
    const byCategory = db
      .prepare(
        `SELECT c.id AS categoryId, c.name, c.color, COUNT(e.id) AS count,
      COALESCE(SUM(e.amount_minor), 0) AS amountMinor FROM categories c
      LEFT JOIN expenses e ON e.category_id = c.id GROUP BY c.id ORDER BY amountMinor DESC, c.name COLLATE NOCASE`,
      )
      .all();
    const ranked = [...byCategory].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
    const least = [...byCategory].sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
    const recent = db
      .prepare(
        `SELECT e.*, u.name AS owner_name, c.name AS category_name FROM expenses e
      JOIN users u ON u.id = e.user_id JOIN categories c ON c.id = e.category_id
      ORDER BY e.created_at DESC, e.id DESC LIMIT 10`,
      )
      .all();
    res.json({
      month,
      ...totals,
      userCount: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
      currentMonthExpenseCount: db
        .prepare('SELECT COUNT(*) AS count FROM expenses WHERE substr(expense_date, 1, 7) = ?')
        .get(month).count,
      byCategory,
      mostUsed: ranked.slice(0, 5),
      leastUsed: least.slice(0, 5),
      recentExpenses: recent.map((row) => ({
        ...expenseFromRow(row),
        ownerName: row.owner_name,
        categoryName: row.category_name,
      })),
      recentUsers: db
        .prepare('SELECT * FROM users ORDER BY created_at DESC, id DESC LIMIT 10')
        .all()
        .map(publicUser),
    });
  });
  return router;
}
