<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.team.name} · Huntboard</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex max-w-content flex-col gap-3 px-gutter py-10">
	<h1 class="type-title">{data.team.name}</h1>
	<p class="type-secondary">Challenges show up here once the game is ready.</p>
</main>
