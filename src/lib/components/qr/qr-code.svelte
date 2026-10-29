<script lang="ts">
	import type { QrCode } from '#lib/client/qr-code.js';
	import { cn } from '#lib/utils.js';

	let { text, label, class: className }: { text: string; label: string; class?: string } = $props();

	let code = $state<QrCode | null>(null);

	// Loaded on demand, so pages that never show a code never download the encoder.
	$effect(() => {
		const current = text;
		let stale = false;
		void import('#lib/client/qr-code.js').then(({ qrCode }) => {
			if (!stale) code = qrCode(current);
		});
		return () => (stale = true);
	});
</script>

<!-- Black on white in every theme and mode: phone scanners misread inverted or low-contrast codes. -->
<div class={cn('aspect-square overflow-hidden rounded-control bg-white', className)}>
	{#if code}
		<svg
			viewBox="0 0 {code.size} {code.size}"
			role="img"
			aria-label={label}
			shape-rendering="crispEdges"
			class="block size-full"
		>
			<path d={code.path} fill="#000" />
		</svg>
	{/if}
</div>
