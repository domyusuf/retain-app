import { openDatabase } from './database.js';
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run admin -w server -- user@example.com');
  process.exitCode = 1;
} else {
  const db = openDatabase();
  const result = db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
  if (result.changes === 0) {
    console.error('No account found. Create the account first.');
    process.exitCode = 1;
  } else console.log('Account promoted to admin.');
  db.close();
}
