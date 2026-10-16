import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import {
  authenticate,
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  publicUser,
  newId,
} from './auth.js';

const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Use at least two characters for your name.').max(80),
    email: z.email().trim().toLowerCase().max(254),
    password: z.string().min(12, 'Use at least 12 characters for your password.').max(128),
  })
  .strict();
const signinSchema = z
  .object({ email: z.email().trim().toLowerCase().max(254), password: z.string().min(1).max(128) })
  .strict();
export function createApp({
  db,
  origin = process.env.APP_ORIGIN || 'http://127.0.0.1:5173',
  production = process.env.NODE_ENV === 'production',
  sessionOptions = {},
  authLimit = 30,
} = {}) {
  if (!db) throw new Error('A database connection is required.');
  const allowedOrigin = new URL(origin).origin;
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: production ? undefined : false }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== allowedOrigin) {
      return res
        .status(403)
        .json({
          error: {
            code: 'ORIGIN_REJECTED',
            message: 'This request did not come from the Retain app.',
          },
        });
    }
    next();
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please try again in 15 minutes.',
      },
    },
  });
  const authenticated = authenticate(db);
  const sessionConfig = { secure: production, ...sessionOptions };
  // Spend a comparable amount of work on unknown accounts to avoid a fast lookup signal.
  const dummyHash = hashPassword('retain-dummy-password');
  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });
  app.post('/api/auth/signup', authLimiter, async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const { name, email, password } = parsed.data;
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res
        .status(409)
        .json({
          error: {
            code: 'EMAIL_EXISTS',
            message: 'An account with this email already exists. Try signing in.',
          },
        });
    }
    const { salt, hash } = await hashPassword(password);
    const id = newId();
    try {
      db.prepare(
        'INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, name, email, hash, salt, new Date().toISOString());
    } catch (error) {
      if (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE/.test(error.message)) {
        return res
          .status(409)
          .json({
            error: {
              code: 'EMAIL_EXISTS',
              message: 'An account with this email already exists. Try signing in.',
            },
          });
      }
      throw error;
    }
    destroySession(db, req, res, production);
    createSession(db, res, id, sessionConfig);
    res
      .status(201)
      .json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  });
  app.post('/api/auth/signin', authLimiter, async (req, res) => {
    const parsed = signinSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const { email, password } = parsed.data;
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const fallback = await dummyHash;
    const verified = await verifyPassword(
      password,
      row?.password_salt || fallback.salt,
      row?.password_hash || fallback.hash,
    );
    if (!row || !verified)
      return res
        .status(401)
        .json({
          error: { code: 'INVALID_CREDENTIALS', message: 'The email or password is incorrect.' },
        });
    destroySession(db, req, res, production);
    createSession(db, res, row.id, sessionConfig);
    res.json({ user: publicUser(row) });
  });
  app.get('/api/auth/me', authenticated, (req, res) => res.json({ user: req.user }));
  app.post('/api/auth/signout', (req, res) => {
    destroySession(db, req, res, production);
    res.status(204).end();
  });
  app.get('/api/categories', authenticated, (req, res) => {
    const categories = db
      .prepare('SELECT id, name, color, is_default FROM categories ORDER BY is_default, name')
      .all();
    res.json({
      categories: categories.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        isDefault: Boolean(row.is_default),
      })),
    });
  });
  app.use('/api', (req, res) =>
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'This endpoint does not exist.' } }),
  );
  const clientDist = resolve(import.meta.dirname, '../../client/dist');
  if (existsSync(resolve(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.get('/{*path}', (req, res) => res.sendFile(resolve(clientDist, 'index.html')));
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed')
      return res
        .status(400)
        .json({ error: { code: 'INVALID_JSON', message: 'The request body must be valid JSON.' } });
    if (error.type === 'entity.too.large')
      return res
        .status(413)
        .json({ error: { code: 'TOO_LARGE', message: 'This request is too large.' } });
    console.error('API request failed:', error.code || error.name);
    res
      .status(500)
      .json({
        error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' },
      });
  });
  return app;
}
function invalid(res, error) {
  return res
    .status(400)
    .json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues[0]?.message || 'Please check the details you entered.',
      },
    });
}
