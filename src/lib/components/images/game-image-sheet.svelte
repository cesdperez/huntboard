<script lang="ts">
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import type { GameImage } from '#lib/images.js';

	type Props = { image: GameImage; open: boolean };

	let { image, open = $bindable() }: Props = $props();
</script>

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
