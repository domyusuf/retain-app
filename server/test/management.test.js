import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
let db, server, base, admin, regular;
const origin = 'http://127.0.0.1:5173';
async function request(path, { method = 'GET', body, cookie = admin } = {}) {
  return fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
before(async () => {
  db = openDatabase(':memory:');
  server = createApp({ db, origin }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const email of ['admin@example.com', 'regular@example.com']) {
    const response = await request('/auth/signup', {
      method: 'POST',
      cookie: '',
      body: { name: 'Test Person', email, password: 'a long test password' },
    });
    assert.equal(response.status, 201);
    const cookie = response.headers.getSetCookie().at(-1).split(';')[0];
    if (email.startsWith('admin')) admin = cookie;
    else regular = cookie;
  }
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run('admin@example.com');
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});
test('every admin endpoint checks authentication and current database role', async () => {
  for (const [path, method, body] of [
    ['/admin/insights', 'GET'],
    ['/admin/categories', 'POST', { name: 'Test', color: '#123456' }],
    ['/admin/categories/food', 'PUT', { name: 'Test', color: '#123456' }],
    ['/admin/categories/food', 'DELETE'],
  ]) {
    assert.equal((await request(path, { method, body, cookie: '' })).status, 401);
    assert.equal((await request(path, { method, body, cookie: regular })).status, 403);
  }
  db.prepare("UPDATE users SET role = 'user' WHERE email = ?").run('admin@example.com');
  assert.equal((await request('/admin/insights')).status, 403);
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run('admin@example.com');
});
test('category CRUD validates input, protects default and reassigns all owners expenses', async () => {
  for (const body of [
    { name: ' ', color: '#123456' },
    { name: 'Test', color: 'red' },
    { name: 'Test', color: '#123456', isDefault: true },
  ])
    assert.equal((await request('/admin/categories', { method: 'POST', body })).status, 400);
  let response = await request('/admin/categories', {
    method: 'POST',
    body: { name: 'Travel', color: '#123456' },
  });
  assert.equal(response.status, 201);
  const { category } = await response.json();
  assert.equal(
    (
      await request('/admin/categories', {
        method: 'POST',
        body: { name: 'travel', color: '#123456' },
      })
    ).status,
    409,
  );
  response = await request(`/admin/categories/${category.id}`, {
    method: 'PUT',
    body: { name: 'Trips', color: '#654321' },
  });
  assert.equal((await response.json()).category.name, 'Trips');
  assert.equal(
    (await request('/admin/categories/uncategorized', { method: 'DELETE' })).status,
    409,
  );
  assert.equal(
    (
      await request('/admin/categories/uncategorized', {
        method: 'PUT',
        body: { name: 'Renamed', color: '#123456' },
      })
    ).status,
    409,
  );
  const date = new Date(Date.now() + 7200000).toISOString().slice(0, 10);
  for (const cookie of [admin, regular]) {
    assert.equal(
      (
        await request('/expenses', {
          method: 'POST',
          cookie,
          body: {
            title: 'Trip',
            amountMinor: 123400,
            categoryId: category.id,
            date,
            paymentMethod: 'cash',
            notes: '',
          },
        })
      ).status,
      201,
    );
  }
  const removed = await request(`/admin/categories/${category.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).reassignedCount, 2);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM expenses WHERE category_id = ?').get('uncategorized')
      .count,
    2,
  );
  assert.equal(db.prepare('SELECT SUM(amount_minor) AS total FROM expenses').get().total, 246800);
  assert.equal(
    (await request(`/admin/categories/${category.id}`, { method: 'DELETE' })).status,
    404,
  );
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
test('platform insights cover all users and include unused categories in least-used rankings', async () => {
  const response = await request('/admin/insights');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.userCount, 2);
  assert.equal(data.expenseCount, 2);
  assert.equal(data.currentMonthExpenseCount, 2);
  assert.equal(data.expenseValueMinor, 246800);
  assert.equal(
    data.byCategory.reduce((total, item) => total + item.amountMinor, 0),
    246800,
  );
  assert.equal(data.mostUsed[0].categoryId, 'uncategorized');
  assert.equal(data.mostUsed[0].count, 2);
  assert.equal(data.leastUsed.length, 5);
  assert.ok(data.leastUsed.every((item) => item.count === 0));
  assert.equal(data.recentExpenses.length, 2);
  assert.equal(data.recentUsers.length, 2);
  assert.ok(data.recentExpenses.every((item) => item.ownerName && item.categoryName));
  assert.ok(
    data.recentUsers.every((item) => !('password_hash' in item) && !('password_salt' in item)),
  );
});
