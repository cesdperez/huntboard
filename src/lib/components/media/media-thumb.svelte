<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import PlayIcon from '@lucide/svelte/icons/play';
	import type { MediaKind } from '#lib/domain/claim-media.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		kind: MediaKind;
		/**
		 * The photo to show, or null for a photo tile while it is not ready. A video always shows the
		 * play tile, so no video loads for a thumbnail.
		 */
		src?: string | null;
		/** Sets the size, like size-10. */
		class?: string;
	};

	let { kind, src = null, class: className }: Props = $props();
</script>

<!-- Decorative: a label always sits beside it. -->
{#if kind === 'photo' && src}
	<img
		{src}
		alt=""
		decoding="async"
		loading="lazy"
		class={cn('shrink-0 rounded-md border bg-paper object-cover', className)}
	/>
{:else if kind === 'photo'}
	<span
		aria-hidden="true"
		class={cn(
			'flex shrink-0 items-center justify-center rounded-md border bg-paper text-muted',
			className
		)}
	>
		<ImageIcon class="size-1/2" />
	</span>
{:else}
	<span
		aria-hidden="true"
		class={cn('flex shrink-0 items-center justify-center rounded-md bg-ink text-paper', className)}
	>
		<PlayIcon class="size-1/2 fill-current" />
	</span>
{/if}
