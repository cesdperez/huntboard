<script lang="ts">
	import { QrCode } from '#lib/components/qr/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';

	let { label, url, open = $bindable() }: { label: string; url: string; open: boolean } = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title class="break-words"><bdi>{label}</bdi> link</Sheet.Title>
			<Sheet.Description class="type-secondary">
				Scan it with a phone camera to open the link.
			</Sheet.Description>
		</Sheet.Header>
		<QrCode text={url} label="QR code of the {label} link" class="mx-auto w-full max-w-[60dvh]" />
		<p class="type-secondary break-all">{url}</p>
	</Sheet.Content>
</Sheet.Root>
