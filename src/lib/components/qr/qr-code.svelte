<script lang="ts">
	import { page } from '$app/state';
	import { resolveTheme, themeImages } from '#lib/themes/index.js';
	import { cn } from '#lib/utils.js';

	let { text, label, class: className }: { text: string; label: string; class?: string } = $props();

	const theme = $derived(resolveTheme(page.data.gameTheme));
	let svg = $state<string | null>(null);

	// Loaded on demand, so pages that never show a code never download the encoder.
	$effect(() => {
		const current = text;
		const style = { ...theme.qr, logo: themeImages(theme).icon };
		let stale = false;
		void import('#lib/client/qr-code.js').then(({ qrSvg }) => {
			if (!stale) svg = qrSvg(current, style);
		});
		return () => (stale = true);
	});
</script>

<!-- Dark on white in every theme and mode: phone scanners misread inverted or low-contrast codes. -->
<div
	role="img"
	aria-label={label}
	class={cn(
		'aspect-square overflow-hidden rounded-control bg-white [&>svg]:block [&>svg]:size-full',
		className
	)}
>
	<!-- The markup is built from the encoded modules and the theme registry, never from page input. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html svg ?? ''}
</div>
