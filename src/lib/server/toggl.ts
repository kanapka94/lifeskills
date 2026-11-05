/**
 * Toggl Track API v9 + Reports API v3 client.
 *
 * All Toggl knowledge lives in this file. The rest of the app only receives
 * "projects" and "seconds per project", so swapping the time source
 * (e.g. a manual timer) won't require any UI changes.
 */

const API_BASE = 'https://api.track.toggl.com/api/v9';
const REPORTS_BASE = 'https://api.track.toggl.com/reports/api/v3';
const REQUEST_TIMEOUT_MS = 15_000;

export class TogglError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = 'TogglError';
	}
}

export type TogglMe = {
	id: number;
	fullname?: string;
	default_workspace_id?: number;
	timezone?: string;
};

export type TogglProject = {
	id: number;
	name: string;
	color?: string | null;
	active?: boolean;
};

export type TogglTimeEntry = {
	id: number;
	project_id?: number | null;
	pid?: number | null;
	duration: number;
	start?: string;
	stop?: string | null;
	description?: string | null;
	tags?: string[] | null;
};

type TogglProjectSummaryItem = {
	project_id?: number;
	id?: number;
	tracked_seconds?: number;
	seconds?: number;
};

export type DateOnlyRange = {
	startDate: string;
	endDate: string;
};

export type ProjectTotalsResult = {
	totals: Map<number, number>;
	source: 'reports' | 'time_entries';
	warning: string | null;
};

/* -------------------------------------------------------------------------- */
/* Low-level HTTP calls                                                       */
/* -------------------------------------------------------------------------- */

function authHeader(token: string): string {
	// Toggl uses the token as the username and the literal "api_token" as the password.
	const encoded = Buffer.from(`${token}:api_token`).toString('base64');
	return `Basic ${encoded}`;
}

async function request<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
	let response: Response;

	try {
		response = await fetch(url, {
			...init,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: authHeader(token),
				...(init.headers ?? {})
			},
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'unknown network error';
		throw new TogglError(`Could not connect to Toggl: ${reason}`);
	}

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		const detail = body.slice(0, 200);

		if (response.status === 401 || response.status === 403) {
			throw new TogglError(
				'Toggl rejected the API token. Check TOGGL_API_TOKEN in .env.',
				response.status
			);
		}

		if (response.status === 429) {
			throw new TogglError('Toggl API limit (30 requests/hour) exceeded. Try again later.', 429);
		}

		throw new TogglError(
			`Toggl API ${response.status}${detail ? `: ${detail}` : ''}`,
			response.status
		);
	}

	return (await response.json()) as T;
}

/**
 * Toggl sometimes returns an array and sometimes an object with an `items`
 * field. We normalize both variants in one place.
 */
function asArray<T>(payload: unknown): T[] {
	if (Array.isArray(payload)) {
		return payload as T[];
	}

	if (payload && typeof payload === 'object') {
		const record = payload as Record<string, unknown>;

		for (const key of ['items', 'groups', 'data']) {
			const value = record[key];
			if (Array.isArray(value)) {
				return value as T[];
			}
		}
	}

	return [];
}

/* -------------------------------------------------------------------------- */
/* Toggl endpoints                                                           */
/* -------------------------------------------------------------------------- */

export function getMe(token: string): Promise<TogglMe> {
	return request<TogglMe>(`${API_BASE}/me`, token);
}

export async function getProjects(token: string): Promise<TogglProject[]> {
	const payload = await request<unknown>(`${API_BASE}/me/projects?include_archived=false`, token);

	return asArray<TogglProject>(payload)
		.filter((project) => project.active !== false)
		.map((project) => ({
			id: Number(project.id),
			name: project.name || `Project ${project.id}`,
			color: typeof project.color === 'string' ? project.color : null,
			active: true
		}))
		.filter((project) => Number.isFinite(project.id) && project.id > 0);
}

/**
 * Seconds per project from the Reports API.
 * This is the preferred source because it covers data older than 3 months.
 */
export async function getProjectTotalsFromReports(
	token: string,
	workspaceId: number,
	startDate: string,
	endDate: string
): Promise<Map<number, number>> {
	const payload = await request<unknown>(
		`${REPORTS_BASE}/workspace/${workspaceId}/projects/summary`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ start_date: startDate, end_date: endDate })
		}
	);

	const totals = new Map<number, number>();

	for (const item of asArray<TogglProjectSummaryItem>(payload)) {
		const projectId = Number(item.project_id ?? item.id);
		const seconds = Number(item.tracked_seconds ?? item.seconds ?? 0);

		if (Number.isFinite(projectId) && projectId > 0 && Number.isFinite(seconds) && seconds > 0) {
			totals.set(projectId, (totals.get(projectId) ?? 0) + seconds);
		}
	}

	return totals;
}

export async function getTimeEntriesForRange(
	token: string,
	startDate: string,
	endDate: string
): Promise<TogglTimeEntry[]> {
	const query = new URLSearchParams({
		start_date: startDate,
		end_date: endDate
	});

	const payload = await request<unknown>(`${API_BASE}/me/time_entries?${query.toString()}`, token);
	return asArray<TogglTimeEntry>(payload);
}

/**
 * Fallback source: individual entries from /me/time_entries.
 * This endpoint only goes back about 3 months and returns at most 1000 entries.
 */
export async function getProjectTotalsFromTimeEntries(
	token: string,
	startDate: string,
	endDate: string
): Promise<{ totals: Map<number, number>; truncated: boolean }> {
	const entries = await getTimeEntriesForRange(token, startDate, endDate);
	const totals = new Map<number, number>();

	for (const entry of entries) {
		const projectId = Number(entry.project_id ?? entry.pid);
		const duration = Number(entry.duration);

		if (Number.isFinite(projectId) && projectId > 0 && Number.isFinite(duration) && duration > 0) {
			totals.set(projectId, (totals.get(projectId) ?? 0) + duration);
		}
	}

	return { totals, truncated: entries.length >= 1000 };
}

/** Used by the diagnostics script to inspect the raw Reports API response. */
export function probeSummaryReport(
	token: string,
	workspaceId: number,
	startDate: string,
	endDate: string
): Promise<unknown> {
	return request<unknown>(`${REPORTS_BASE}/workspace/${workspaceId}/summary/time_entries`, token, {
		method: 'POST',
		body: JSON.stringify({
			start_date: startDate,
			end_date: endDate,
			grouping: 'projects'
		})
	});
}

/* -------------------------------------------------------------------------- */
/* Dates and ranges                                                          */
/* -------------------------------------------------------------------------- */

export function toDateOnly(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
	const copy = new Date(date.getTime());
	copy.setUTCDate(copy.getUTCDate() + days);
	return copy;
}

/**
 * By default we take the last 12 months. The date can be overridden in .env:
 * TOGGL_START_DATE=2024-01-01
 */
export function resolveHistoryStart(value: string | undefined, now = new Date()): Date {
	const fallback = addDays(now, -365);
	const trimmed = value?.trim();

	if (!trimmed) {
		return fallback;
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		throw new Error(`Invalid TOGGL_START_DATE: "${trimmed}". Use the YYYY-MM-DD format.`);
	}

	const parsed = new Date(`${trimmed}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`Invalid TOGGL_START_DATE: "${trimmed}".`);
	}

	if (parsed.getTime() > now.getTime()) {
		throw new Error('TOGGL_START_DATE cannot be a future date.');
	}

	return parsed;
}

/**
 * The Reports API allows ranges of up to 365 days. We split a larger range
 * into smaller chunks to avoid a 400 error.
 */
export function splitDateRange(start: Date, end: Date, maxDays = 365): DateOnlyRange[] {
	if (start.getTime() > end.getTime()) {
		return [];
	}

	const ranges: DateOnlyRange[] = [];
	let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
	const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

	while (cursor.getTime() <= endDay.getTime()) {
		const chunkEnd = addDays(cursor, maxDays - 1);
		const actualEnd = chunkEnd.getTime() > endDay.getTime() ? endDay : chunkEnd;

		ranges.push({
			startDate: toDateOnly(cursor),
			endDate: toDateOnly(actualEnd)
		});

		cursor = addDays(actualEnd, 1);
	}

	return ranges;
}

function isReportsUnavailable(error: unknown): boolean {
	if (!(error instanceof TogglError) || error.status === undefined) {
		return false;
	}

	return [400, 402, 403, 404, 405, 501].includes(error.status);
}

/**
 * Returns seconds per project for the entire configured range.
 *
 * It first tries the Reports API. If the plan/workspace doesn't provide it,
 * it falls back to /me/time_entries for the last 90 days and returns a warning.
 */
export async function getProjectTotals(
	token: string,
	workspaceId: number | null,
	start: Date,
	end: Date
): Promise<ProjectTotalsResult> {
	if (start.getTime() > end.getTime()) {
		throw new Error('The range start date is later than the end date.');
	}

	const ranges = splitDateRange(start, end);

	if (ranges.length === 0) {
		return { totals: new Map(), source: 'reports', warning: null };
	}

	if (workspaceId) {
		try {
			const totals = new Map<number, number>();

			for (const range of ranges) {
				const chunk = await getProjectTotalsFromReports(
					token,
					workspaceId,
					range.startDate,
					range.endDate
				);

				for (const [projectId, seconds] of chunk) {
					totals.set(projectId, (totals.get(projectId) ?? 0) + seconds);
				}
			}

			return { totals, source: 'reports', warning: null };
		} catch (error) {
			if (!isReportsUnavailable(error)) {
				throw error;
			}
		}
	}

	const fallbackStart = new Date(Math.max(start.getTime(), addDays(end, -90).getTime()));
	const { totals, truncated } = await getProjectTotalsFromTimeEntries(
		token,
		toDateOnly(fallbackStart),
		toDateOnly(end)
	);

	const warnings = [
		'Toggl Reports API is not available for this workspace — counting only the last 90 days from /me/time_entries.'
	];

	if (truncated) {
		warnings.push('Toggl returned the 1000-entry limit — the total may be incomplete.');
	}

	return {
		totals,
		source: 'time_entries',
		warning: warnings.join(' ')
	};
}
