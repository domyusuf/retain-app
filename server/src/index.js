import { openDatabase } from './database.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be a valid port number.');
if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN?.startsWith('https://')) {
  throw new Error('APP_ORIGIN must be the public HTTPS application origin in production.');
}
const db = openDatabase();
const app = createApp({ db });
const server = app.listen(port, () => console.log(`Retain API listening on port ${port}`));
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
