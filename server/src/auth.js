import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
export const sessionCookie = 'retain_session';
export const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;
const passwordOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await deriveKey(password, salt, 64, passwordOptions);
  return { salt, hash: hash.toString('hex') };
}
export async function verifyPassword(password, salt, hash) {
  const candidate = await hashPassword(password, salt);
  const expected = Buffer.from(hash, 'hex');
  const actual = Buffer.from(candidate.hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
export function readSessionToken(req) {
  const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`));
  return cookie?.slice(sessionCookie.length + 1) || null;
}
export function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
}
export function createSession(db, res, userId, { secure = false, durationMs = sessionDurationMs } = {}) {
  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, Date.now() + durationMs);
  res.cookie(sessionCookie, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: durationMs });
}
export function destroySession(db, req, res, secure = false) {
  const token = readSessionToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  res.clearCookie(sessionCookie, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
}
export function authenticate(db) {
  return (req, res, next) => {
    const token = readSessionToken(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } });
    const user = db.prepare(`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(hashToken(token), Date.now());
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Your session has ended. Please sign in again.' } });
    req.user = publicUser(user);
    next();
  };
}
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This action requires an admin account.' } });
  next();
}
export function newId() { return randomUUID(); }
