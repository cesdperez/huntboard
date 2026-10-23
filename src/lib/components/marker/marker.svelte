<script lang="ts">
	import { cn } from '#lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { markerLabel, type MarkerState } from './marker-label.js';

	type Props = HTMLAttributes<HTMLSpanElement> & {
		state: MarkerState;
		/** Awarded points, shown only when scored. */
		points?: number;
		/** `list` is 28px for rows, `grid` is 40px for the admin grid. */
		size?: 'list' | 'grid';
	};

	let { state, points, size = 'list', class: className, ...restProps }: Props = $props();

	const showPoints = $derived(state === 'scored' && points !== undefined);
</script>

<span
	role="img"
	aria-label={markerLabel(state, points)}
	data-slot="marker"
	data-state={state}
	data-size={size}
	class={cn('marker', className)}
	{...restProps}
>
	{#if showPoints}
		<span class="marker-points" data-long={String(points).length > 2 || undefined}>{points}</span>
	{:else if state === 'rejected'}
		<svg class="marker-cross" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true">
			<path d="M0 0 L10 10 M10 0 L0 10" />
		</svg>
	{/if}
</span>

<style>
	.marker {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: var(--spacing-marker);
		height: var(--spacing-marker);
		border: 2px solid var(--muted);
		border-radius: var(--radius-marker);
		background: transparent;
		overflow: hidden;
		transition:
			background-color 150ms ease-out,
			border-color 150ms ease-out;
	}

	.marker[data-size='grid'] {
		width: var(--spacing-marker-lg);
		height: var(--spacing-marker-lg);
	}

	.marker[data-state='pending'] {
		border-color: var(--ink);
	}

	/* The control flag: lower-right half filled. */
	.marker[data-state='pending']::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--marker);
		clip-path: polygon(100% 0, 100% 100%, 0 100%);
	}

	.marker[data-state='scored'] {
		border-color: var(--marker);
		background: var(--marker);
		color: var(--on-marker);
	}

	.marker[data-state='rejected'] {
		border-color: var(--danger);
	}

	.marker-points {
		font-size: 12px;
		line-height: 1;
		font-weight: 700;
		font-stretch: var(--stretch-condensed);
		font-variant-numeric: tabular-nums;
	}

	.marker[data-size='grid'] .marker-points {
		font-size: 16px;
	}

	.marker-points[data-long] {
		font-stretch: var(--stretch-compressed);
	}

	.marker-cross {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		stroke: var(--danger);
		stroke-width: 1.5px;
	}

	.marker-cross path {
		vector-effect: non-scaling-stroke;
	}
</style>
