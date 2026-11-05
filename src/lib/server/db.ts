import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Database layer.
 *
 * We deliberately use raw SQL instead of an ORM:
 * - you can see exactly which queries hit the database,
 * - there is no generated client or migrations,
 * - the schema is small and easy to extend.
 *
 * When the project grows (loot, achievements, boss), moving this to Prisma
 * will mostly mean rewriting these few functions.
 */

export type Db = Database.Database;

export type User = {
	id: number;
	username: string;
	password_hash: string;
	display_name: string;
	toggl_workspace_id: number | null;
	created_at: string;
};

/** User shape safe to send to the browser (without the password hash). */
export type PublicUser = Omit<User, 'password_hash'>;

export type Skill = {
	id: number;
	user_id: number;
	toggl_project_id: number;
	name: string;
	color: string | null;
	total_seconds: number;
	active: number;
	updated_at: string;
};

export type SyncState = {
	user_id: number;
	last_synced_at: string | null;
	last_attempt_at: string | null;
	last_error: string | null;
	last_warning: string | null;
};

export type UpsertUserInput = {
	username: string;
	passwordHash: string;
	displayName: string;
};

export type UpsertSkillInput = {
	userId: number;
	togglProjectId: number;
	name: string;
	color: string | null;
	totalSeconds: number;
};

export function openDb(path = 'data/lifeexp.db'): Db {
	const absolutePath = resolve(path);
	mkdirSync(dirname(absolutePath), { recursive: true });

	const db = new Database(absolutePath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE COLLATE NOCASE,
			password_hash TEXT NOT NULL,
			display_name TEXT NOT NULL,
			toggl_workspace_id INTEGER,
			created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		);

		CREATE TABLE IF NOT EXISTS skills (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			toggl_project_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			color TEXT,
			total_seconds INTEGER NOT NULL DEFAULT 0,
			active INTEGER NOT NULL DEFAULT 1,
			updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			UNIQUE (user_id, toggl_project_id)
		);

		CREATE TABLE IF NOT EXISTS sync_state (
			user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			last_synced_at TEXT,
			last_attempt_at TEXT,
			last_error TEXT,
			last_warning TEXT
		);

		CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
	`);

	return db;
}

/* -------------------------------------------------------------------------- */
/* Users                                                                    */
/* -------------------------------------------------------------------------- */

export function findUserByUsername(db: Db, username: string): User | undefined {
	return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
}

export function findUserById(db: Db, id: number): User | undefined {
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function upsertUser(db: Db, input: UpsertUserInput): User {
	db.prepare(
		`
			INSERT INTO users (username, password_hash, display_name)
			VALUES (@username, @passwordHash, @displayName)
			ON CONFLICT(username) DO UPDATE SET
				password_hash = excluded.password_hash,
				display_name = excluded.display_name
		`
	).run(input);

	const user = findUserByUsername(db, input.username);
	if (!user) {
		throw new Error('Failed to create the user.');
	}

	return user;
}

export function toPublicUser(user: User): PublicUser {
	return {
		id: user.id,
		username: user.username,
		display_name: user.display_name,
		toggl_workspace_id: user.toggl_workspace_id,
		created_at: user.created_at
	};
}

export function setTogglWorkspaceId(db: Db, userId: number, workspaceId: number): void {
	db.prepare('UPDATE users SET toggl_workspace_id = ? WHERE id = ?').run(workspaceId, userId);
}

/* -------------------------------------------------------------------------- */
/* Skills (Toggl projects)                                                   */
/* -------------------------------------------------------------------------- */

export function listSkills(db: Db, userId: number): Skill[] {
	return db
		.prepare(
			`
				SELECT *
				FROM skills
				WHERE user_id = ? AND active = 1
				ORDER BY name COLLATE NOCASE
			`
		)
		.all(userId) as Skill[];
}

export function upsertSkill(db: Db, input: UpsertSkillInput): void {
	db.prepare(
		`
			INSERT INTO skills (user_id, toggl_project_id, name, color, total_seconds, active)
			VALUES (@userId, @togglProjectId, @name, @color, @totalSeconds, 1)
			ON CONFLICT(user_id, toggl_project_id) DO UPDATE SET
				name = excluded.name,
				color = excluded.color,
				total_seconds = excluded.total_seconds,
				active = 1,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		`
	).run(input);
}

/**
 * Projects deleted/archived in Toggl don't disappear from the database
 * immediately. We mark them as inactive so we don't lose XP history.
 */
export function deactivateMissingSkills(db: Db, userId: number, activeProjectIds: number[]): void {
	if (activeProjectIds.length === 0) {
		db.prepare('UPDATE skills SET active = 0 WHERE user_id = ?').run(userId);
		return;
	}

	const placeholders = activeProjectIds.map(() => '?').join(', ');
	db.prepare(
		`UPDATE skills SET active = 0 WHERE user_id = ? AND toggl_project_id NOT IN (${placeholders})`
	).run(userId, ...activeProjectIds);
}

/* -------------------------------------------------------------------------- */
/* Sync state                                                                */
/* -------------------------------------------------------------------------- */

export function getSyncState(db: Db, userId: number): SyncState {
	const row = db.prepare('SELECT * FROM sync_state WHERE user_id = ?').get(userId) as
		SyncState | undefined;

	return (
		row ?? {
			user_id: userId,
			last_synced_at: null,
			last_attempt_at: null,
			last_error: null,
			last_warning: null
		}
	);
}

export function saveSyncSuccess(db: Db, userId: number, warning: string | null = null): void {
	db.prepare(
		`
			INSERT INTO sync_state (user_id, last_synced_at, last_attempt_at, last_error, last_warning)
			VALUES (
				?,
				strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
				strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
				NULL,
				?
			)
			ON CONFLICT(user_id) DO UPDATE SET
				last_synced_at = excluded.last_synced_at,
				last_attempt_at = excluded.last_attempt_at,
				last_error = NULL,
				last_warning = excluded.last_warning
		`
	).run(userId, warning);
}

export function saveSyncError(db: Db, userId: number, message: string): void {
	db.prepare(
		`
			INSERT INTO sync_state (user_id, last_attempt_at, last_error, last_warning)
			VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, NULL)
			ON CONFLICT(user_id) DO UPDATE SET
				last_attempt_at = excluded.last_attempt_at,
				last_error = excluded.last_error,
				last_warning = NULL
		`
	).run(userId, message);
}
