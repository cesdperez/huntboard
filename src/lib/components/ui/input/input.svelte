<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '#lib/utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...restProps
	}: WithElementRef<HTMLInputAttributes> = $props();
</script>

<input
	bind:this={ref}
	bind:value
	data-slot="input"
	class={cn(
		'min-h-touch w-full min-w-0 rounded-control border-2 border-input-line bg-surface px-3 text-ink placeholder:text-muted focus-visible:border-ink disabled:opacity-50 aria-invalid:border-danger',
		className
	)}
	{...restProps}
/>
