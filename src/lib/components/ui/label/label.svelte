<script lang="ts">
	import type { HTMLLabelAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '#lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLLabelAttributes> = $props();
</script>

<label bind:this={ref} data-slot="label" class={cn('font-semibold', className)} {...restProps}>
	{@render children?.()}
</label>
