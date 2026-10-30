<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';
	import LinkQrSheet from './link-qr-sheet.svelte';
	import { updateOrRetry } from './update-or-retry.js';

	let {
		id,
		label,
		hint,
		url,
		action,
		teamId,
		rotated = false
	}: {
		id: string;
		label: string;
		hint: string;
		url: string;
		action: string;
		teamId?: number;
		rotated?: boolean;
	} = $props();

	let field = $state<HTMLInputElement | null>(null);
	let copyState = $state<'idle' | 'copied' | 'manual'>('idle');
	let confirming = $state(false);
	let submitting = $state(false);
	let showingQr = $state(false);
	let rotateButton = $state<HTMLElement | null>(null);
	let cancelButton = $state<HTMLElement | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	const status = $derived(
		copyState === 'copied'
			? 'Link copied.'
			: copyState === 'manual'
				? 'Copying is blocked here. The link is selected, so copy it by hand.'
				: rotated
					? 'New link made. The old one no longer works.'
					: ''
	);

	async function setConfirming(value: boolean) {
		confirming = value;
		await tick();
		(value ? cancelButton : rotateButton)?.focus();
	}

	async function copy() {
		clearTimeout(resetTimer);
		try {
			await navigator.clipboard.writeText(url);
			copyState = 'copied';
			resetTimer = setTimeout(() => (copyState = 'idle'), 2000);
		} catch {
			field?.focus();
			field?.select();
			copyState = 'manual';
		}
	}
</script>

<li class="flex flex-col gap-3 border-b border-line py-4">
	<div class="flex flex-col gap-1">
		<label for={id} class="font-semibold break-words">{label}</label>
		<p class="type-secondary">{hint}</p>
	</div>

	<input
		bind:this={field}
		{id}
		value={url}
		readonly
		onfocus={(event) => event.currentTarget.select()}
		class="min-h-touch w-full min-w-0 truncate rounded-control border-2 border-input-line bg-surface px-3 text-ink focus-visible:border-ink"
	/>

	<div class="flex flex-col">
		{#if confirming}
			<form
				method="POST"
				action="?/{action}"
				class="flex flex-col gap-3"
				use:enhance={() => {
					submitting = true;
					return async (settled) => {
						const { result } = settled;
						void setConfirming(false);
						submitting = false;
						// Only the admin rotate redirects: the new page needs to say its own link changed.
						if (result.type === 'redirect') {
							// Replace, so Back does not land on the old link, which is now a 404.
							// The server built the location with resolve().
							// eslint-disable-next-line svelte/no-navigation-without-resolve
							await goto(result.location, {
								replace: true,
								reset: false,
								state: { adminLinkRotated: true }
							});
							return;
						}
						await updateOrRetry(settled);
					};
				}}
			>
				{#if teamId !== undefined}
					<input type="hidden" name="teamId" value={teamId} />
				{/if}
				<p class="type-secondary">The current link stops working at once. Share the new one.</p>
				<div class="flex gap-3">
					<Button bind:ref={cancelButton} variant="ghost" onclick={() => setConfirming(false)}>
						Cancel
					</Button>
					<Button type="submit" variant="destructive" disabled={submitting}>
						Rotate link<span class="sr-only"> for {label}</span>
					</Button>
				</div>
			</form>
		{:else}
			<div class="flex gap-3">
				<Button onclick={copy}>
					{copyState === 'copied' ? 'Copied' : 'Copy'}<span class="sr-only"> {label} link</span>
				</Button>
				<Button onclick={() => (showingQr = true)}>
					Show QR<span class="sr-only"> code of the {label} link</span>
				</Button>
				<Button bind:ref={rotateButton} variant="destructive" onclick={() => setConfirming(true)}>
					Rotate<span class="sr-only"> {label} link</span>
				</Button>
			</div>
		{/if}

		<p class={cn('type-secondary', status && 'mt-3')} role="status">{status}</p>
	</div>

	<LinkQrSheet {label} {url} bind:open={showingQr} />
</li>
