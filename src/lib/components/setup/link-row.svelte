<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { startPolling } from '#lib/client/live-updates.js';
	import { needsRetry } from '#lib/components/admin/admin-message.js';
	import { RETRY } from '#lib/components/team/action-message.js';
	import { toast } from '#lib/components/toast/index.js';
	import { generateToken } from '#lib/domain/token.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { RotatedLink } from '#lib/server/use-cases/links.js';
	import { cn } from '#lib/utils.js';
	import { AdminLinkRotation } from './admin-link-rotation.svelte.js';
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
	let newAdminField = $state<HTMLInputElement | null>(null);
	let copyState = $state<'idle' | 'copied' | 'manual'>('idle');
	let confirming = $state(false);
	let submitting = $state(false);
	let showingQr = $state(false);
	// A new rotate makes "New link made" from the last one stale until it gets its own answer.
	let rotating = $state(false);
	let rotateButton = $state<HTMLElement | null>(null);
	let cancelButton = $state<HTMLElement | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	const rotatesAdmin = $derived(action === 'linksRotateAdmin');
	// Kept until an answer comes, so a retry after a lost answer sends it again and rotates once.
	let newToken: string | null = null;
	const rotatedLink = $derived<RotatedLink>(teamId === undefined ? 'scoreboard' : `team-${teamId}`);

	const adminSetup = (token: string) => resolve('/a/[token]/setup', { token });

	async function adminLinkWorks(token: string): Promise<boolean> {
		const response = await fetch(adminSetup(token), { method: 'HEAD', cache: 'no-store' }).catch(
			() => null
		);
		return response?.ok === true;
	}

	// Replace, so Back does not land on the old link, which is now a 404.
	function moveTo(location: string) {
		submitting = false;
		rotating = false;
		void setConfirming(false);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the server's redirect and adminSetup both come from resolve()
		return goto(location, { replace: true, reset: false, state: { adminLinkRotated: true } });
	}

	// The browser makes the new admin token, so it knows the new link even when the answer is lost.
	const rotation = new AdminLinkRotation(
		() => page.params.token ?? '',
		adminLinkWorks,
		(token) => moveTo(adminSetup(token))
	);

	// Again on every admin link this row shows, as moving to the new link keeps the component.
	$effect(() => {
		if (!rotatesAdmin || !page.params.token) return;
		untrack(() => void rotation.restore());
	});

	$effect(() => {
		if (!rotation.unsure) return;
		return startPolling(async () => {
			if ((await rotation.recheck()) === 'kept') toast.show(RETRY);
		});
	});

	const newAdminUrl = $derived(rotation.pending && url.replace(/[^/]+$/, rotation.pending));

	const status = $derived(
		copyState === 'copied'
			? 'Link copied.'
			: copyState === 'manual'
				? 'Copying is blocked here. The link is selected, so copy it by hand.'
				: rotated && !rotating
					? 'New link made. The old one no longer works.'
					: ''
	);

	async function setConfirming(value: boolean) {
		confirming = value;
		await tick();
		(value ? cancelButton : rotateButton)?.focus();
	}

	async function copy(text: string, input: HTMLInputElement | null) {
		clearTimeout(resetTimer);
		try {
			await navigator.clipboard.writeText(text);
			copyState = 'copied';
			resetTimer = setTimeout(() => (copyState = 'idle'), 2000);
		} catch {
			input?.focus();
			input?.select();
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

	{#if rotation.unsure && rotation.pending && newAdminUrl}
		<div class="flex flex-col gap-3 rounded-control border-2 border-danger p-3" role="alert">
			<p class="text-[15px]">
				Rotating got no answer, so it may have gone through. Then the link above no longer works and
				this is the new admin link. Open it or copy it now. This page checks it again once you are
				back online.
			</p>
			<input
				bind:this={newAdminField}
				value={newAdminUrl}
				readonly
				aria-label="New admin link"
				onfocus={(event) => event.currentTarget.select()}
				class="min-h-touch w-full min-w-0 truncate rounded-control border-2 border-input-line bg-surface px-3 text-ink focus-visible:border-ink"
			/>
			<div class="flex gap-3">
				<Button href={adminSetup(rotation.pending)} data-sveltekit-replacestate>
					Open new link
				</Button>
				<Button onclick={() => copy(newAdminUrl, newAdminField)}>Copy new link</Button>
			</div>
		</div>
	{/if}

	<div class="flex flex-col">
		{#if confirming}
			<form
				method="POST"
				action="?/{action}"
				class="flex flex-col gap-3"
				use:enhance={async ({ formData, cancel }) => {
					submitting = true;
					rotating = true;
					if (rotatesAdmin) {
						// An earlier rotate whose answer was lost may have gone through after all.
						if (rotation.pending && (await rotation.recheck()) === 'moved') return cancel();
						formData.set('adminToken', rotation.begin());
					} else {
						newToken ??= generateToken();
						formData.set('token', newToken);
					}
					const sent = newToken;
					return async (settled) => {
						const { result } = settled;
						submitting = false;
						// Before the update, so it keeps focus on the Rotate button that replaced this form.
						await setConfirming(false);
						// Only the admin rotate redirects: the new page needs to say its own link changed.
						if (result.type === 'redirect') {
							rotation.clear();
							await moveTo(result.location);
							return;
						}
						// A lost answer may hide a rotation that went through, which leaves this link dead,
						// so a refresh would land on the dead link page. Both links tell what happened.
						if (rotatesAdmin && needsRetry(result)) {
							if ((await rotation.recheck()) === 'kept') toast.show(RETRY);
							return;
						}
						// A dead link keeps the new token, for the dead link page to offer.
						if (rotatesAdmin && result.type === 'failure') rotation.clear();
						const answer = await updateOrRetry(settled, {
							tookEffect: () => url.endsWith(`/${sent}`) && { links: { rotated: rotatedLink } }
						});
						if (!needsRetry(answer)) {
							newToken = null;
							rotating = false;
						}
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
					<Button type="submit" variant="destructive" busy={submitting}>
						Rotate link<span class="sr-only"> for {label}</span>
					</Button>
				</div>
			</form>
		{:else}
			<div class="flex gap-3">
				<Button onclick={() => copy(url, field)}>
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
