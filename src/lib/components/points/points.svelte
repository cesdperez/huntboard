<script lang="ts">
	import { pageLayout } from '#lib/themes/page-layout.js';
	import { cn } from '#lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLSpanElement> &
		({ value: number; min?: never; max?: never } | { value?: never; min: number; max: number }) & {
			/** `range` for challenge point ranges, `total` for score totals and ranks. */
			variant?: 'range' | 'total';
		};

	let { value, min, max, variant = 'range', class: className, ...restProps }: Props = $props();

	const formatted = (n: number) => (n < 0 ? `\u2212${-n}` : String(n));
	// Thin spaces around the dash in the event layout's roomier points column.
	const dash = $derived(pageLayout() === 'event' ? '\u2009\u2013\u2009' : '\u2013');

	const low = $derived(value ?? min ?? 0);
	const high = $derived(value ?? max ?? low);
	const text = $derived(
		low === high ? formatted(low) : `${formatted(low)}${dash}${formatted(high)}`
	);
	const label = $derived(low === high ? undefined : `${low} to ${high} points`);
</script>

<span
	data-slot="points"
	class={cn(
		variant === 'total' ? 'type-score text-score' : 'type-range',
		'whitespace-nowrap',
		className
	)}
	{...restProps}
>
	{#if label}
		<span aria-hidden="true">{text}</span><span class="sr-only">{label}</span>
	{:else if variant === 'range'}
		{text} <span class="sr-only">points</span>
	{:else}
		{text}
	{/if}
</span>
