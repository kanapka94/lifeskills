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
		'✖ Brak TOGGL_API_TOKEN w .env.\n' +
			'  Toggl Track → Profile Settings → API Token, potem wklej token do .env.'
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

	console.log('— Konto —');
	const me = await getMe(token);
	console.log({
		id: me.id,
		fullname: me.fullname,
		default_workspace_id: me.default_workspace_id,
		timezone: me.timezone
	});

	console.log('\n— Projekty (GET /me/projects) —');
	const projects = await getProjects(token);
	console.log(`Znaleziono ${projects.length} aktywnych projektów.`);
	console.table(
		projects.map((project) => ({
			id: project.id,
			name: project.name,
			color: project.color
		}))
	);

	const workspaceId = me.default_workspace_id;

	if (!workspaceId) {
		throw new Error('Konto nie ma default_workspace_id — nie da się pobrać raportów.');
	}

	console.log(`\n— Raport projektów (Reports API, workspace ${workspaceId}) —`);
	console.log(`Zakres: ${toDateOnly(historyStart)} → ${toDateOnly(now)}`);

	const totals = new Map<number, number>();
	const ranges = splitDateRange(historyStart, now);

	console.log(`Zakres podzielony na ${ranges.length} zapytań (limit 365 dni).`);

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

		console.log(`  ✔ ${range.startDate} → ${range.endDate}: ${chunk.size} projektów`);
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
	console.error('\n✖ Reports API nie zadziałało:', describeError(error));
	console.error('  Próbuję awaryjnego źródła: /me/time_entries z ostatnich 90 dni…');

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
			console.warn('⚠ Toggl zwrócił limit 1000 wpisów — suma może być niepełna.');
		}

		console.warn('⚠ Aplikacja użyje tego trybu awaryjnego, ale obejmie on tylko ostatnie 90 dni.');
	} catch (fallbackError) {
		console.error('✖ Awaryjne źródło też nie zadziałało:', describeError(fallbackError));
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
