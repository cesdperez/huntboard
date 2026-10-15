<script lang="ts">
	import { enhance } from '$app/forms';
	import { GAME_NAME_MAX_LENGTH } from '#lib/game-settings.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Turnstile from '#lib/components/turnstile.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	let token = $state('');
	let challenge: Turnstile | undefined = $state();
</script>

<svelte:head>
	<title>New game · Huntboard</title>
</svelte:head>

<main class="mx-auto flex max-w-content flex-col gap-6 px-gutter py-10">
	<h1 class="type-title">New game</h1>

	<form
		method="POST"
		class="flex flex-col gap-5"
		use:enhance={({ cancel }) => {
			if (!token || submitting) {
				cancel();
				return;
			}
			submitting = true;
			return async ({ update }) => {
				try {
					await update({ reset: false });
				} finally {
					challenge?.reset();
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
			/>
		</div>

		<div class="flex flex-col gap-2">
			<Label for="code">Creation code</Label>
			<Input
				id="code"
				name="code"
				type="password"
				required
				autocomplete="off"
				aria-invalid={form?.error ? true : undefined}
				aria-describedby={form?.error ? 'new-game-error' : undefined}
			/>
		</div>

		{#if data.turnstileSiteKey}
			<Turnstile siteKey={data.turnstileSiteKey} bind:token bind:this={challenge} />
		{:else}
			<p class="text-[15px] text-danger" role="alert">
				Game creation is unavailable. Try again shortly.
			</p>
		{/if}
		<noscript
			><p class="text-[15px] text-danger">
				Enable JavaScript to complete verification and create a game.
			</p></noscript
		>

		{#if form?.error}
			<p id="new-game-error" class="text-[15px] text-danger" role="alert">{form.error}</p>
		{/if}

		<Button type="submit" variant="primary" size="lg" disabled={submitting || !token}
			>Create game</Button
		>
	</form>
</main>
