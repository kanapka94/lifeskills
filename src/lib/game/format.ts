const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeStyle: 'short'
});

/** 3725 s -> "1 hr 2 min" */
export function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours} hr ${minutes} min`;
	}

	if (minutes > 0) {
		return `${minutes} min`;
	}

	return `${seconds} s`;
}

/** 125 s -> "3 min" (rounded up so we never show "0 min"). */
export function formatWait(totalSeconds: number): string {
	if (totalSeconds <= 0) {
		return 'now';
	}

	const minutes = Math.ceil(totalSeconds / 60);

	if (minutes < 60) {
		return `${minutes} min`;
	}

	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;

	return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function formatDateTime(iso: string | null): string {
	if (!iso) {
		return 'not synced yet';
	}

	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return 'unknown date';
	}

	return dateTimeFormatter.format(date);
}
