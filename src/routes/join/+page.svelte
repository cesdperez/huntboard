<script lang="ts">
	import { enhance } from '$app/forms';
	import { AppBar, PageBanner } from '#lib/components/event/index.js';
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
	<title>Join a team · Huntboard</title>
</svelte:head>

{#if event}
	<header>
		<AppBar />
		<PageBanner title="Join a team">Type the code your organiser gave you.</PageBanner>
	</header>
{/if}

<main class="mx-auto flex max-w-content flex-col gap-6 px-gutter {event ? 'py-6' : 'py-10'}">
	{#if !event}
		<h1 class="type-title">Join a team</h1>
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
			<Label for="code">Join code</Label>
			<Input
				id="code"
				name="code"
				required
				maxlength={32}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck={false}
				enterkeyhint="go"
				placeholder="K7Q4-M2XD"
				class="font-score text-[20px] tracking-wider uppercase"
				value={form?.code ?? ''}
				aria-invalid={form?.error ? true : undefined}
				aria-describedby={form?.error ? 'join-error' : undefined}
			/>
		</div>

		{#if form?.error}
			<p id="join-error" class="text-[15px] text-danger" role="alert">{form.error}</p>
		{/if}

		<Button type="submit" variant="primary" size="lg" busy={submitting}>Join</Button>
	</form>
</main>
