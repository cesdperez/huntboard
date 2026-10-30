<script lang="ts">
	import { enhance } from '$app/forms';
	import { AppBar, PageBanner } from '#lib/components/event/index.js';
	import { GAME_NAME_MAX_LENGTH } from '#lib/domain/game-settings.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);

	const event = $derived(pageLayout() === 'event');
</script>

<svelte:head>
	<title>New game · Huntboard</title>
</svelte:head>

{#if event}
	<AppBar />
	<PageBanner title="New game">Name it and start setting it up.</PageBanner>
{/if}

<main class="mx-auto flex max-w-content flex-col gap-6 px-gutter {event ? 'py-6' : 'py-10'}">
	{#if !event}
		<h1 class="type-title">New game</h1>
	{/if}

	<form
		method="POST"
		class="flex flex-col gap-5"
		use:enhance={({ cancel }) => {
			if (submitting) {
				cancel();
				return;
			}
			submitting = true;
			return async ({ update }) => {
				try {
					await update({ reset: false });
				} finally {
					submitting = false;
				}
			};
		}}
	>
		<div class="flex flex-col gap-2">
			<Label for="name">Game name</Label>
			<Input
				id="name"
				name="name"
				required
				maxlength={GAME_NAME_MAX_LENGTH}
				value={form?.name ?? ''}
				aria-invalid={form?.error ? true : undefined}
				aria-describedby={form?.error ? 'new-game-error' : undefined}
			/>
		</div>

		{#if form?.error}
			<p id="new-game-error" class="text-[15px] text-danger" role="alert">{form.error}</p>
		{/if}

		<Button type="submit" variant="primary" size="lg" busy={submitting}>Create game</Button>
	</form>
</main>
