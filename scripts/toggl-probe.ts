/**
 * Toggl Track diagnostics.
 *
 * Usage:
 *   npm run toggl:probe
 *
 * The script checks step by step what works on your account and plan:
 * 1. GET /me
 * 2. GET /me/projects
 * 3. POST /reports/api/v3/.../projects/summary
 * 4. fallback GET /me/time_entries (last 90 days only)
 *
 * This consumes a few of the 30 free requests per hour, so don't run it
 * in a loop.
 */
import {
	TogglError,
	getMe,
	getProjectTotalsFromReports,
	getProjectTotalsFromTimeEntries,
	getProjects,
	resolveHistoryStart,
	splitDateRange,
	toDateOnly
} from '../src/lib/server/toggl';

const token = process.env.TOGGL_API_TOKEN?.trim();

if (!token) {
	console.error(
		'✖ Missing TOGGL_API_TOKEN in .env.\n' +
			'  Toggl Track → Profile Settings → API Token, then paste the token into .env.'
	);
	process.exit(1);
}

function hours(seconds: number): string {
	return (seconds / 3600).toFixed(2) + ' h';
}

function describeError(error: unknown): string {
	if (error instanceof TogglError) {
		return `${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`;
	}

	return error instanceof Error ? error.message : String(error);
}

try {
	const now = new Date();
	const historyStart = resolveHistoryStart(process.env.TOGGL_START_DATE, now);

	console.log('— Account —');
	const me = await getMe(token);
	console.log({
		id: me.id,
		fullname: me.fullname,
		default_workspace_id: me.default_workspace_id,
		timezone: me.timezone
	});

	console.log('\n— Projects (GET /me/projects) —');
	const projects = await getProjects(token);
	console.log(`Found ${projects.length} active projects.`);
	console.table(
		projects.map((project) => ({
			id: project.id,
			name: project.name,
			color: project.color
		}))
	);

	const workspaceId = me.default_workspace_id;

	if (!workspaceId) {
		throw new Error('The account has no default_workspace_id — cannot fetch reports.');
	}

	console.log(`\n— Project report (Reports API, workspace ${workspaceId}) —`);
	console.log(`Range: ${toDateOnly(historyStart)} → ${toDateOnly(now)}`);

	const totals = new Map<number, number>();
	const ranges = splitDateRange(historyStart, now);

	console.log(`Range split into ${ranges.length} requests (365-day limit).`);

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

		console.log(`  ✔ ${range.startDate} → ${range.endDate}: ${chunk.size} projects`);
	}

	console.table(
		projects.map((project) => {
			const seconds = totals.get(project.id) ?? 0;

			return {
				id: project.id,
				name: project.name,
				seconds,
				time: hours(seconds),
				xp: Math.floor(seconds / 6),
				level: estimateLevel(Math.floor(seconds / 6))
			};
		})
	);
} catch (error) {
	console.error('\n✖ Reports API failed:', describeError(error));
	console.error('  Trying the fallback source: /me/time_entries for the last 90 days…');

	try {
		const now = new Date();
		const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
		const { totals, truncated } = await getProjectTotalsFromTimeEntries(
			token,
			toDateOnly(start),
			toDateOnly(now)
		);

		console.table(
			[...totals.entries()].map(([projectId, seconds]) => ({
				project_id: projectId,
				seconds,
				time: hours(seconds)
			}))
		);

		if (truncated) {
			console.warn('⚠ Toggl returned the 1000-entry limit — the total may be incomplete.');
		}

		console.warn('⚠ The app will use this fallback mode, but it only covers the last 90 days.');
	} catch (fallbackError) {
		console.error('✖ The fallback source also failed:', describeError(fallbackError));
		process.exitCode = 1;
	}
}

/** For console preview only — the real math lives in src/lib/game/xp.ts. */
function estimateLevel(xp: number): number {
	let level = 1;

	while (25 * level * (level + 3) <= xp) {
		level += 1;
	}

	return level;
}
