/**
 * Creates (or updates) the admin account based on .env.
 *
 * Usage:
 *   npm run db:seed
 *
 * The script is safe to run multiple times — the password and display name
 * are overwritten with the current values from .env.
 */
import { hashPassword } from '../src/lib/server/auth';
import { openDb, upsertUser } from '../src/lib/server/db';

function required(name: string): string {
	const value = process.env[name]?.trim();

	if (!value) {
		throw new Error(`Brak ${name} w .env. Uzupełnij go przed uruchomieniem seeda.`);
	}

	return value;
}

const username = required('ADMIN_USERNAME');
const password = required('ADMIN_PASSWORD');
const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || username;
const databasePath = process.env.DATABASE_PATH?.trim() || 'data/lifeexp.db';

if (password.length < 8) {
	throw new Error('ADMIN_PASSWORD musi mieć co najmniej 8 znaków.');
}

const db = openDb(databasePath);

try {
	const passwordHash = await hashPassword(password);
	const user = upsertUser(db, { username, passwordHash, displayName });

	console.log(`✔ Konto gotowe: ${user.username} (${user.display_name}), id=${user.id}`);
	console.log(`  Baza: ${databasePath}`);
} finally {
	db.close();
}
