<script lang="ts">
	import { enhance } from '$app/forms';
	import PasskeyButton from '#lib/components/account/passkey-button.svelte';
	import { AppBar, PageBanner } from '#lib/components/event/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { DISPLAY_NAME_MAX_LENGTH, normalizeDisplayName } from '#lib/domain/account.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let signInError = $state<string | null>(null);
	let signUpError = $state<string | null>(null);
	let nameInput = $state<HTMLInputElement | null>(null);

	const event = $derived(pageLayout() === 'event');
	const googleAction = $derived(`?/google&next=${encodeURIComponent(data.next)}`);
	const shownSignInError = $derived(signInError ?? data.error);
	const shownSignUpError = $derived(signUpError ?? form?.error ?? null);

	function typedName(): string | null {
		const name = normalizeDisplayName(nameInput?.value);
		if (!name) nameInput?.reportValidity();
		return name;
	}
</script>

<svelte:head>
	<title>Sign in · Huntboard</title>
</svelte:head>

{#if event}
	<AppBar />
	<PageBanner title="Sign in">For organisers. Players only need their team link.</PageBanner>
{/if}

<main class="mx-auto flex max-w-content flex-col gap-10 px-gutter {event ? 'py-6' : 'py-10'}">
	<section aria-labelledby="sign-in-heading" class="flex flex-col gap-4">
		{#if event}
			<h2 id="sign-in-heading" class="font-display type-heading">Welcome back</h2>
		{:else}
			<h1 id="sign-in-heading" class="type-title">Sign in</h1>
			<p class="type-secondary">For organisers. Players only need their team link.</p>
		{/if}

		{#if shownSignInError}
			<p class="text-[15px] text-danger" role="alert">{shownSignInError}</p>
		{/if}

		<PasskeyButton
			intent="sign-in"
			next={data.next}
			variant="primary"
			class="w-full"
			onerror={(message) => (signInError = message)}
		>
			Sign in with a passkey
		</PasskeyButton>
		{#if data.googleEnabled}
			<form method="POST" action={googleAction}>
				<input type="hidden" name="intent" value="sign-in" />
				<Button type="submit" class="w-full">Sign in with Google</Button>
			</form>
		{/if}
	</section>

	<section aria-labelledby="sign-up-heading" class="flex flex-col gap-4 border-t border-line pt-8">
		<h2 id="sign-up-heading" class="font-display type-heading">New here?</h2>
		<p class="type-secondary">
			Create an account to make games and find them again later. Use a passkey on this phone or
			computer{data.googleEnabled ? ', or your Google account' : ''}.
		</p>

		<form
			method="POST"
			action={googleAction}
			class="flex flex-col gap-4"
			use:enhance={({ cancel }) => {
				// Without Google, Enter in the name field would post a sign-up the server cannot start.
				if (!data.googleEnabled) cancel();
			}}
		>
			<input type="hidden" name="intent" value="sign-up" />
			<div class="flex flex-col gap-2">
				<Label for="display-name">Your name</Label>
				<Input
					id="display-name"
					name="displayName"
					required
					autocomplete="name"
					maxlength={DISPLAY_NAME_MAX_LENGTH}
					value={form?.displayName ?? ''}
					bind:ref={nameInput}
					aria-invalid={shownSignUpError ? true : undefined}
					aria-describedby="display-name-hint{shownSignUpError ? ' sign-up-error' : ''}"
				/>
				<p id="display-name-hint" class="type-secondary">
					Shown on your account. Players do not see it.
				</p>
			</div>

			{#if shownSignUpError}
				<p id="sign-up-error" class="text-[15px] text-danger" role="alert">{shownSignUpError}</p>
			{/if}

			<PasskeyButton
				intent="sign-up"
				next={data.next}
				class="w-full"
				displayName={typedName}
				onerror={(message) => (signUpError = message)}
			>
				Create account with a passkey
			</PasskeyButton>
			{#if data.googleEnabled}
				<Button type="submit" class="w-full">Create account with Google</Button>
			{/if}
		</form>
	</section>
</main>
