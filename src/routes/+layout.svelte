<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { resolveAppearance, supportedModes } from '#lib/themes/index.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const appearance = $derived(resolveAppearance(page.data.gameTheme, page.data.colorMode));
	const modes = $derived(appearance.mode ? [appearance.mode] : supportedModes(appearance.theme));

	// The server sets these on <html>. Client-side navigation keeps them in step.
	$effect(() => {
		const root = document.documentElement;
		root.dataset.gameTheme = appearance.theme.id;
		if (appearance.mode) root.dataset.theme = appearance.mode;
		else delete root.dataset.theme;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="color-scheme" content={modes.join(' ')} />
	{#each modes as mode (mode)}
		<meta
			name="theme-color"
			content={appearance.theme.modes[mode]?.themeColor}
			media={modes.length > 1 ? `(prefers-color-scheme: ${mode})` : undefined}
		/>
	{/each}
	{#if appearance.theme.fonts.length > 0}
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	{/if}
	{#each appearance.theme.fonts as href (href)}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>

{@render children()}
