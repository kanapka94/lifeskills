import { openDb, type Db } from './db';
import { runtimeEnv } from './runtime-env';

/**
 * One database instance per process.
 *
 * In dev mode SvelteKit can reload modules when a file changes. Keeping the
 * connection on `globalThis` prevents opening multiple handles to the same
 * SQLite file.
 */
const globalForDb = globalThis as unknown as { lifeexpDb?: Db };

export const db = globalForDb.lifeexpDb ?? openDb(runtimeEnv.databasePath);

globalForDb.lifeexpDb = db;
