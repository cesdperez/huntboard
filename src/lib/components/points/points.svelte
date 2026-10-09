<script lang="ts">
	import { cn } from '#lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLSpanElement> &
		({ value: number; min?: never; max?: never } | { value?: never; min: number; max: number }) & {
			/** `range` for challenge point ranges, `total` for score totals and ranks. */
			variant?: 'range' | 'total';
		};

	let { value, min, max, variant = 'range', class: className, ...restProps }: Props = $props();

	const formatted = (n: number) => (n < 0 ? `\u2212${-n}` : String(n));

	const low = $derived(value ?? min ?? 0);
	const high = $derived(value ?? max ?? low);
	const text = $derived(
		low === high ? formatted(low) : `${formatted(low)}\u2013${formatted(high)}`
	);
	const label = $derived(low === high ? undefined : `${low} to ${high} points`);
</script>

<span
	data-slot="points"
	class={cn(variant === 'total' ? 'type-score' : 'type-range', 'whitespace-nowrap', className)}
	aria-label={label}
	{...restProps}>{text}</span
>
