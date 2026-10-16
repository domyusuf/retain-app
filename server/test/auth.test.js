import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { authenticate, requireAdmin, hashToken } from '../src/auth.js';

const origin = 'http://localhost:5173';
let db, server, base;
before(async () => {
  db = openDatabase(':memory:');
  server = createApp({ db, origin }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
async function request(path, { method = 'GET', body, cookie, requestOrigin = origin } = {}) {
  return fetch(`${base}${path}`, { method, headers: { Origin: requestOrigin, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
}
const account = { name: 'Test Student', email: 'student@example.com', password: 'a long demo password' };
function cookieFrom(response) { return response.headers.getSetCookie().at(-1).split(';')[0]; }

test('API reports database health and blocks unauthenticated private reads', async () => {
  assert.equal((await request('/api/health')).status, 200);
  for (const path of ['/api/auth/me', '/api/categories']) assert.equal((await request(path)).status, 401);
  assert.equal((await request('/api/not-an-endpoint')).status, 404);
});
test('signup hashes passwords, issues a protected cookie and restores sessions', async () => {
  const response = await request('/api/auth/signup', { method: 'POST', body: account });
  assert.equal(response.status, 201);
  const { user } = await response.json();
  assert.equal(user.email, account.email); assert.equal(user.role, 'user');
  assert.equal(user.password_hash, undefined); assert.equal(user.password, undefined);
  const cookies = response.headers.getSetCookie().join(';');
  assert.match(cookies, /HttpOnly/); assert.match(cookies, /SameSite=Lax/);
  const cookie = cookieFrom(response);
  const stored = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  assert.notEqual(stored.password_hash, account.password); assert.equal(stored.password_hash.length, 128);
  const session = db.prepare('SELECT * FROM sessions WHERE user_id = ?').get(user.id);
  assert.equal(session.token_hash, hashToken(cookie.split('=')[1]));
  assert.equal((await (await request('/api/auth/me', { cookie })).json()).user.id, user.id);
  const categoryResponse = await request('/api/categories', { cookie });
  assert.equal(categoryResponse.status, 200);
  assert.equal((await categoryResponse.json()).categories.filter(item => item.isDefault).length, 1);
});
test('signup validates data, prevents role escalation and rejects duplicate emails', async () => {
  assert.equal((await request('/api/auth/signup', { method: 'POST', body: { ...account, password: 'short' } })).status, 400);
  assert.equal((await request('/api/auth/signup', { method: 'POST', body: { ...account, email: 'role@example.com', role: 'admin' } })).status, 400);
  assert.equal((await request('/api/auth/signup', { method: 'POST', body: { ...account, email: 'STUDENT@EXAMPLE.COM' } })).status, 409);
});
test('signin rejects bad credentials without exposing which account exists', async () => {
  const known = await request('/api/auth/signin', { method: 'POST', body: { email: account.email, password: 'wrong' } });
  const unknown = await request('/api/auth/signin', { method: 'POST', body: { email: 'unknown@example.com', password: 'wrong' } });
  assert.equal(known.status, 401); assert.equal(unknown.status, 401);
  assert.deepEqual(await known.json(), await unknown.json());
});
test('successful signin rotates the current session and signout invalidates it', async () => {
  const first = await request('/api/auth/signin', { method: 'POST', body: { email: account.email, password: account.password } });
  const oldCookie = cookieFrom(first);
  const second = await request('/api/auth/signin', { method: 'POST', body: { email: account.email, password: account.password }, cookie: oldCookie });
  assert.equal(second.status, 200);
  const newCookie = cookieFrom(second); assert.notEqual(newCookie, oldCookie);
  assert.equal((await request('/api/auth/me', { cookie: oldCookie })).status, 401);
  assert.equal((await request('/api/auth/me', { cookie: newCookie })).status, 200);
  assert.equal((await request('/api/auth/signout', { method: 'POST', cookie: newCookie })).status, 204);
  assert.equal((await request('/api/auth/me', { cookie: newCookie })).status, 401);
});
test('expired and malformed sessions cannot authenticate', async () => {
  const response = await request('/api/auth/signin', { method: 'POST', body: { email: account.email, password: account.password } });
  const cookie = cookieFrom(response);
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(Date.now() - 1000, hashToken(cookie.split('=')[1]));
  assert.equal((await request('/api/auth/me', { cookie })).status, 401);
  assert.equal((await request('/api/auth/me', { cookie: 'retain_session=malformed' })).status, 401);
});
test('cross-origin and missing-origin mutations are rejected', async () => {
  assert.equal((await request('/api/auth/signout', { method: 'POST', requestOrigin: 'https://other.example' })).status, 403);
  assert.equal((await fetch(`${base}/api/auth/signout`, { method: 'POST' })).status, 403);
});
test('admin middleware denies regular users and checks current database roles', async () => {
  const response = await request('/api/auth/signin', { method: 'POST', body: { email: account.email, password: account.password } });
  const cookie = cookieFrom(response);
  const denied = await new Promise(resolve => {
    authenticate(db)({ headers: { cookie } }, { status: status => ({ json: () => resolve(status) }) }, () => resolve(200));
  });
  assert.equal(denied, 200);
  const check = user => { let status = 200; requireAdmin({ user }, { status: code => ({ json: () => { status = code; } }) }, () => {}); return status; };
  assert.equal(check({ role: 'user' }), 403); assert.equal(check({ role: 'admin' }), 200);
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(account.email);
  assert.equal((await (await request('/api/auth/me', { cookie })).json()).user.role, 'admin');
  db.prepare("UPDATE users SET role = 'user' WHERE email = ?").run(account.email);
});
test('production cookies require HTTPS transport', async () => {
  const localDb = openDatabase(':memory:');
  const secureServer = createApp({ db: localDb, origin: 'https://retain.example', production: true }).listen(0, '127.0.0.1');
  await once(secureServer, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${secureServer.address().port}/api/auth/signup`, {
      method: 'POST', headers: { Origin: 'https://retain.example', 'Content-Type': 'application/json' }, body: JSON.stringify(account),
    });
    assert.equal(response.status, 201); assert.match(response.headers.getSetCookie().join(';'), /Secure/);
  } finally { await new Promise(resolve => secureServer.close(resolve)); localDb.close(); }
});
test('authentication limits repeated attempts', async () => {
  const localDb = openDatabase(':memory:');
  const limitedServer = createApp({ db: localDb, origin, authLimit: 2 }).listen(0, '127.0.0.1');
  await once(limitedServer, 'listening');
  try {
    const url = `http://127.0.0.1:${limitedServer.address().port}/api/auth/signin`;
    const options = { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' };
    await fetch(url, options); await fetch(url, options);
    assert.equal((await fetch(url, options)).status, 429);
  } finally { await new Promise(resolve => limitedServer.close(resolve)); localDb.close(); }
});
test('users and schema persist after reopening a database without duplicate categories', () => {
  const directory = mkdtempSync(join(tmpdir(), 'retain-db-'));
  const filename = join(directory, 'test.db');
  try {
    let connection = openDatabase(filename);
    connection.prepare('INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('persistent', 'Student', 'persistent@example.com', 'hash', 'salt', new Date().toISOString());
    const categories = connection.prepare('SELECT count(*) AS count FROM categories').get().count;
    connection.close(); connection = openDatabase(filename);
    assert.equal(connection.prepare('SELECT name FROM users WHERE id = ?').get('persistent').name, 'Student');
    assert.equal(connection.prepare('SELECT count(*) AS count FROM categories').get().count, categories);
    assert.throws(() => connection.prepare("INSERT INTO expenses (id,user_id,category_id,title,amount_minor,expense_date,payment_method,created_at,updated_at) VALUES ('x','missing','food','Lunch',100,'2026-10-16','cash','now','now')").run(), /FOREIGN KEY/);
    connection.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
