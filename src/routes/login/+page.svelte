<script lang="ts">
	import { enhance } from '$app/forms';
	import DisplayNameField from '#lib/components/account/display-name-field.svelte';
	import { AppBar, PageBanner } from '#lib/components/event/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { EMAIL_MAX_LENGTH } from '#lib/domain/account.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let otherEmail = $state(false);

	const event = $derived(pageLayout() === 'event');
	const codeResult = $derived(form && 'code' in form ? form : null);
	const codeEnded = $derived(codeResult?.needsNewEmail ?? false);
	const sentTo = $derived(otherEmail || codeEnded ? null : (form?.sent ?? data.pendingEmail));
	const requestAction = $derived(`?/request&next=${encodeURIComponent(data.next)}`);
	const codeError = $derived(codeEnded ? null : (codeResult?.error ?? null));
	const emailError = $derived(
		form && 'email' in form ? form.error : codeEnded ? (codeResult?.error ?? null) : null
	);
</script>

<svelte:head>
	<title>Sign in · Huntboard</title>
</svelte:head>

{#if event}
	<AppBar />
	<PageBanner title="Sign in">For organisers. Players only need their team link.</PageBanner>
{/if}

<main class="mx-auto flex max-w-content flex-col gap-6 px-gutter {event ? 'py-6' : 'py-10'}">
	{#if !event}
		<div>
			<h1 class="type-title">Sign in</h1>
			<p class="mt-1 type-secondary">For organisers. Players only need their team link.</p>
		</div>
	{/if}

	{#if sentTo}
		<section aria-labelledby="check-heading" class="flex flex-col gap-4">
			<h2 id="check-heading" class="font-display type-heading">Check your email</h2>
			<p class="type-secondary">
				We sent a sign-in link and a code to <strong class="text-ink">{sentTo}</strong>. Open the
				link, or type the code here.
			</p>

			{#if form && 'preview' in form && form.preview}
				<div
					class="flex flex-col gap-1 border-2 border-dashed border-line p-3"
					data-testid="preview"
				>
					<p class="font-semibold">Dev server: no email was sent.</p>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={form.preview.link} class="break-all underline">Sign-in link</a>
					<p>Code: <span data-testid="preview-code">{form.preview.code}</span></p>
				</div>
			{/if}

			<form method="POST" action="?/code" class="flex flex-col gap-4" use:enhance>
				<div class="flex flex-col gap-2">
					<Label for="code">Code</Label>
					<Input
						id="code"
						name="code"
						required
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength={7}
						value={form && 'code' in form ? form.code : ''}
						aria-invalid={codeError ? true : undefined}
					/>
				</div>
				{#if form && 'needsName' in form && form.needsName}
					<DisplayNameField error={codeError} />
				{/if}
				{#if codeError}
					<p class="text-[15px] text-danger" role="alert">{codeError}</p>
				{/if}
				<Button type="submit" variant="primary" size="lg">Sign in</Button>
			</form>

			<Button variant="ghost" class="w-full" onclick={() => (otherEmail = true)}>
				Use a different email
			</Button>
		</section>
	{:else}
		<form
			method="POST"
			action={requestAction}
			class="flex flex-col gap-4"
			use:enhance={() => {
				return async ({ result, update }) => {
					// A refused address stays on this form; only a sent email moves on to the code.
					if (result.type === 'success') otherEmail = false;
					await update({ reset: false });
				};
			}}
		>
			<div class="flex flex-col gap-2">
				<Label for="email">Email</Label>
				<Input
					id="email"
					name="email"
					type="email"
					required
					autocomplete="email"
					maxlength={EMAIL_MAX_LENGTH}
					value={form && 'email' in form ? form.email : ''}
					aria-invalid={emailError ? true : undefined}
					aria-describedby="email-hint"
				/>
				<p id="email-hint" class="type-secondary">
					We email you a link to sign in. New here? The same link creates your account.
				</p>
			</div>
			{#if emailError}
				<p class="text-[15px] text-danger" role="alert">{emailError}</p>
			{/if}
			<Button type="submit" variant="primary" size="lg">Email me a sign-in link</Button>
		</form>
	{/if}
</main>
