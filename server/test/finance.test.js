import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';

let db, server, base, alice, bob;
const origin = 'http://127.0.0.1:5173';
const sample = {
  title: 'Lunch',
  amountMinor: 450000,
  categoryId: 'food',
  date: '2026-10-17',
  paymentMethod: 'cash',
  notes: 'Cafe near campus',
};
async function request(path, { method = 'GET', body, cookie = alice } = {}) {
  return fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
async function create(body = sample, cookie = alice) {
  const response = await request('/expenses', { method: 'POST', body, cookie });
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  return (await response.json()).expense;
}
before(async () => {
  db = openDatabase(':memory:');
  server = createApp({ db, origin }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
  const signup = async (email) => {
    const response = await request('/auth/signup', {
      method: 'POST',
      body: { name: 'Test User', email, password: 'a long test password' },
      cookie: '',
    });
    assert.equal(response.status, 201);
    return response.headers.getSetCookie().at(-1).split(';')[0];
  };
  alice = await signup('alice@example.com');
  bob = await signup('bob@example.com');
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

test('finance endpoints require an authenticated session', async () => {
  for (const path of ['/expenses', '/expenses/all', '/budgets', '/dashboard?month=2026-10'])
    assert.equal((await request(path, { cookie: '' })).status, 401);
  assert.equal(
    (await request('/expenses', { method: 'POST', body: sample, cookie: '' })).status,
    401,
  );
});
test('expense CRUD preserves fields and hides all other users records', async () => {
  const item = await create();
  assert.equal(item.title, sample.title);
  assert.equal(item.amountMinor, sample.amountMinor);
  assert.equal(item.notes, sample.notes);
  assert.equal(item.userId, undefined);
  assert.equal((await request(`/expenses/${item.id}`, { cookie: bob })).status, 404);
  assert.equal(
    (
      await request(`/expenses/${item.id}`, {
        method: 'PUT',
        cookie: bob,
        body: { ...sample, amountMinor: 1 },
      })
    ).status,
    404,
  );
  assert.equal(
    (await request(`/expenses/${item.id}`, { method: 'DELETE', cookie: bob })).status,
    404,
  );
  assert.equal((await (await request('/expenses/all', { cookie: bob })).json()).expenses.length, 0);
  const update = await request(`/expenses/${item.id}`, {
    method: 'PUT',
    body: { ...sample, title: 'Dinner', paymentMethod: 'mobile_money', notes: '' },
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).expense.title, 'Dinner');
  assert.equal((await request(`/expenses/${item.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await request(`/expenses/${item.id}`)).status, 404);
});
test('invalid money, dates, categories, methods and ownership fields are rejected', async () => {
  for (const patch of [
    { amountMinor: 0 },
    { amountMinor: -1 },
    { amountMinor: 12.5 },
    { amountMinor: 100_000_000_000 },
    { date: '2026-02-30' },
    { date: '2025-02-29' },
    { date: '17/10/2026' },
    { title: '   ' },
    { categoryId: 'missing' },
    { paymentMethod: 'other' },
    { userId: 'another-user' },
  ]) {
    assert.equal(
      (await request('/expenses', { method: 'POST', body: { ...sample, ...patch } })).status,
      400,
      JSON.stringify(patch),
    );
  }
  const leap = await create({ ...sample, date: '2024-02-29' });
  await request(`/expenses/${leap.id}`, { method: 'DELETE' });
});
test('API supports combined literal search, filters, stable sorting and pagination', async () => {
  await create({
    ...sample,
    title: 'Market vegetables',
    notes: 'receipt 50% food',
    amountMinor: 500000,
    date: '2026-10-02',
  });
  await create({
    ...sample,
    title: 'Bus pass',
    categoryId: 'transport',
    paymentMethod: 'mobile_money',
    amountMinor: 200000,
    date: '2026-10-03',
  });
  await create({ ...sample, title: 'Rice', amountMinor: 100000, date: '2026-10-04' });
  await create({ ...sample, title: 'Last month', date: '2026-09-30', amountMinor: 999000 });
  await create({ ...sample, title: 'Other user', amountMinor: 999999 }, bob);
  const data = await (
    await request('/expenses?month=2026-10&sort=amount_desc&pageSize=2&page=1')
  ).json();
  assert.equal(data.total, 3);
  assert.equal(data.totalPages, 2);
  assert.deepEqual(
    data.expenses.map((e) => e.amountMinor),
    [500000, 200000],
  );
  const next = await (
    await request('/expenses?month=2026-10&sort=amount_desc&pageSize=2&page=2')
  ).json();
  assert.deepEqual(
    next.expenses.map((e) => e.amountMinor),
    [100000],
  );
  const filtered = await (
    await request(
      '/expenses?categoryId=food&paymentMethod=cash&startDate=2026-10-01&endDate=2026-10-03&minAmountMinor=400000&maxAmountMinor=500000&query=50%25',
    )
  ).json();
  assert.equal(filtered.total, 1);
  assert.equal(filtered.expenses[0].title, 'Market vegetables');
  const noMatch = await (await request('/expenses?query=%27%20OR%201%3D1')).json();
  assert.equal(noMatch.total, 0);
  for (const query of [
    'sort=DROP',
    'page=-1',
    'pageSize=101',
    'minAmountMinor=abc',
    'minAmountMinor=3&maxAmountMinor=1',
    'startDate=2026-10-02&endDate=2026-10-01',
    'month=2026-13',
  ]) {
    assert.equal((await request(`/expenses?${query}`)).status, 400, query);
  }
});
test('monthly budgets are upserted per user and cannot accept a forged owner', async () => {
  assert.equal((await (await request('/budgets/2026-10')).json()).budget, null);
  assert.equal(
    (await request('/budgets/2026-10', { method: 'PUT', body: { amountMinor: 1000000 } })).status,
    200,
  );
  assert.equal(
    (await request('/budgets/2026-10', { method: 'PUT', body: { amountMinor: 2000000 } })).status,
    200,
  );
  const aliceBudgets = await (await request('/budgets')).json();
  assert.equal(aliceBudgets.budgets.length, 1);
  assert.equal(aliceBudgets.budgets[0].amountMinor, 2000000);
  assert.equal((await (await request('/budgets/2026-10', { cookie: bob })).json()).budget, null);
  await request('/budgets/2026-10', { method: 'PUT', body: { amountMinor: 500000 }, cookie: bob });
  assert.equal((await (await request('/budgets/2026-10')).json()).budget.amountMinor, 2000000);
  assert.equal(
    (await request('/budgets/2026-13', { method: 'PUT', body: { amountMinor: 100 } })).status,
    400,
  );
  assert.equal(
    (await request('/budgets/2026-10', { method: 'PUT', body: { amountMinor: 0 } })).status,
    400,
  );
  assert.equal(
    (
      await request('/budgets/2026-10', {
        method: 'PUT',
        body: { amountMinor: 100, userId: 'forged' },
      })
    ).status,
    400,
  );
});
test('dashboard totals cover the entire selected month, preserve isolation and report all budget states', async () => {
  let dashboard = await (await request('/dashboard?month=2026-10')).json();
  assert.equal(dashboard.spentMinor, 800000);
  assert.equal(dashboard.expenseCount, 3);
  assert.equal(dashboard.highestExpense.amountMinor, 500000);
  assert.equal(dashboard.remainingMinor, 1200000);
  assert.equal(dashboard.budgetStatus, 'within');
  assert.equal(
    dashboard.byCategory.reduce((s, c) => s + c.amountMinor, 0),
    dashboard.spentMinor,
  );
  await request('/budgets/2026-10', { method: 'PUT', body: { amountMinor: 1000000 } });
  dashboard = await (await request('/dashboard?month=2026-10')).json();
  assert.equal(dashboard.budgetStatus, 'approaching');
  await request('/budgets/2026-10', { method: 'PUT', body: { amountMinor: 700000 } });
  dashboard = await (await request('/dashboard?month=2026-10')).json();
  assert.equal(dashboard.budgetStatus, 'over');
  assert.equal(dashboard.remainingMinor, -100000);
  const empty = await (await request('/dashboard?month=2026-11')).json();
  assert.equal(empty.budgetStatus, 'unset');
  assert.equal(empty.highestExpense, null);
  assert.equal(empty.spentMinor, 0);
  assert.equal(empty.remainingMinor, null);
  const other = await (await request('/dashboard?month=2026-10', { cookie: bob })).json();
  assert.equal(other.expenseCount, 1);
  assert.equal(other.spentMinor, 999999);
});
