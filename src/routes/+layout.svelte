<script lang="ts">
	import '../app.css';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { connection } from '#lib/components/connection/index.js';
	import { resolveAppearance, supportedModes, themeImages } from '#lib/themes/index.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const appearance = $derived(resolveAppearance(page.data.gameTheme, page.data.colorMode));
	const modes = $derived(appearance.mode ? [appearance.mode] : supportedModes(appearance.theme));
	const images = $derived(themeImages(appearance.theme));

	// Pages that do not poll would otherwise keep the offline notice after loading fine. A failed
	// load offline also lands on the error page, so that says nothing about the connection.
	afterNavigate(() => {
		if (page.error) return;
		connection.online = true;
		connection.stale = false;
	});

	// The server sets these on <html>. Client-side navigation keeps them in step.
	$effect(() => {
		const root = document.documentElement;
		root.dataset.gameTheme = appearance.theme.id;
		if (appearance.mode) root.dataset.theme = appearance.mode;
		else delete root.dataset.theme;
	});
</script>

<svelte:head>
	<link rel="icon" href={images.icon} type="image/svg+xml" />
	<link rel="apple-touch-icon" href={images.touchIcon} />
	<!-- Link previews in chats. The image URL must be absolute. -->
	<meta property="og:site_name" content="Huntboard" />
	<meta property="og:title" content={page.data.game?.name ?? 'Huntboard'} />
	<meta property="og:description" content="A live scoreboard for team scavenger hunts." />
	<meta property="og:image" content={new URL(images.share, page.url.origin).href} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
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
