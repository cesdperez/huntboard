<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import type { GameImage } from '#lib/images.js';
	import { cn } from '#lib/utils.js';

	type Props = { image: GameImage; class?: string };

	let { image, class: className }: Props = $props();

	let open = $state(false);
</script>

<button
	type="button"
	class={cn('game-image flex min-h-row w-full items-center gap-3 py-1 text-left', className)}
	onclick={() => (open = true)}
>
	<img
		src={image.src}
		alt=""
		decoding="async"
		class="game-image-thumb size-12 shrink-0 rounded-sm border object-cover"
	/>
	<span class="game-image-label min-w-0 flex-1 truncate"
		><span class="sr-only">View </span>{image.label}</span
	>
	<span class="game-image-view flex shrink-0 items-center gap-1 type-secondary" aria-hidden="true">
		View
		<ChevronRightIcon class="size-5" />
	</span>
</button>

<Sheet.Root bind:open>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>{image.label}</Sheet.Title>
		</Sheet.Header>
		<img
			src={image.src}
			alt={image.label}
			decoding="async"
			class="max-h-[70dvh] w-full rounded-sm object-contain"
		/>
	</Sheet.Content>
</Sheet.Root>
