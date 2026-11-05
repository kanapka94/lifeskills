<script lang="ts">
	type Props = {
		value: number;
		color?: string | null;
		label?: string;
		size?: 'sm' | 'md';
	};

	let { value, color = null, label = 'Progress', size = 'md' }: Props = $props();

	const percent = $derived(Math.round(Math.min(1, Math.max(0, value)) * 100));
	const barStyle = $derived(
		color ? `width: ${percent}%; background: ${color};` : `width: ${percent}%;`
	);
	const trackClass = $derived(size === 'sm' ? 'h-2' : 'h-3');
</script>

<div
	class="relative overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10 {trackClass}"
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={percent}
>
	<div
		class="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.35)] transition-[width] duration-700 ease-out"
		style={barStyle}
	></div>
</div>
