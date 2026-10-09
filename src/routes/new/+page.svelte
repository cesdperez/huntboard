<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>New game · Huntboard</title>
</svelte:head>

<main class="mx-auto flex max-w-content flex-col gap-6 px-gutter py-10">
	<h1 class="type-title">New game</h1>

	<form
		method="POST"
		class="flex flex-col gap-5"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update({ reset: false });
				submitting = false;
			};
		}}
	>
		<div class="flex flex-col gap-2">
			<Label for="name">Game name</Label>
			<Input id="name" name="name" required maxlength={100} value={form?.name ?? ''} />
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

		{#if form?.error}
			<p id="new-game-error" class="text-[15px] text-danger" role="alert">{form.error}</p>
		{/if}

		<Button type="submit" variant="primary" size="lg" disabled={submitting}>Create game</Button>
	</form>
</main>
