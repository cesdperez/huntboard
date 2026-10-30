<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import DisplayNameField from '#lib/components/account/display-name-field.svelte';
	import { AppBar, PageBanner } from '#lib/components/event/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const event = $derived(pageLayout() === 'event');
	const error = $derived(form?.error ?? null);
</script>

<svelte:head>
	<title>Sign in · Huntboard</title>
</svelte:head>

{#if event}
	<AppBar />
	<PageBanner title="Sign in" />
{/if}

<main class="mx-auto flex max-w-content flex-col gap-6 px-gutter {event ? 'py-6' : 'py-10'}">
	{#if !event}
		<h1 class="type-title">Sign in</h1>
	{/if}

	{#if data.link}
		<p class="break-words">Signing in as <strong>{data.link.email}</strong>.</p>
		<form method="POST" class="flex flex-col gap-4" use:enhance>
			<input type="hidden" name="token" value={data.token} />
			{#if data.link.isNew}
				<DisplayNameField error={form?.nameError ?? null} />
			{/if}
			{#if error}
				<p class="text-[15px] text-danger" role="alert">{error}</p>
			{/if}
			<Button type="submit" variant="primary" size="lg">
				{data.link.isNew ? 'Create account' : 'Sign in'}
			</Button>
		</form>
	{:else}
		<p role="alert">This sign-in link has expired or was already used.</p>
		<Button href={resolve('/login')} variant="primary" size="lg">Ask for a new email</Button>
	{/if}
</main>
