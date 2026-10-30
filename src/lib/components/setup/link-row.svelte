<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { needsRetry } from '#lib/components/admin/admin-message.js';
	import { RETRY } from '#lib/components/team/action-message.js';
	import { toast } from '#lib/components/toast/index.js';
	import { generateToken } from '#lib/domain/token.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { RotatedLink } from '#lib/server/use-cases/links.js';
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

	// The browser makes the new admin token, so it knows the new link even when the answer is lost.
	const rotatesAdmin = $derived(action === 'linksRotateAdmin');
	let newAdminToken: string | null = null;
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
		newAdminToken = null;
		void setConfirming(false);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the server's redirect and adminSetup both come from resolve()
		return goto(location, { replace: true, reset: false, state: { adminLinkRotated: true } });
	}

	const goToAdminLink = (token: string) => moveTo(adminSetup(token));

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
				use:enhance={async ({ formData, cancel }) => {
					submitting = true;
					if (rotatesAdmin) {
						if (newAdminToken && (await adminLinkWorks(newAdminToken))) {
							cancel();
							return goToAdminLink(newAdminToken);
						}
						newAdminToken = generateToken();
						formData.set('adminToken', newAdminToken);
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
							await moveTo(result.location);
							return;
						}
						// A lost answer may hide a rotation that went through, which leaves this link dead,
						// so a refresh would land on the dead link page. The next tap checks the new link first.
						if (newAdminToken && needsRetry(result)) {
							if (await adminLinkWorks(newAdminToken)) await goToAdminLink(newAdminToken);
							else toast.show(RETRY);
							return;
						}
						const answer = await updateOrRetry(settled, {
							tookEffect: () => url.endsWith(`/${sent}`) && { links: { rotated: rotatedLink } }
						});
						if (!needsRetry(answer)) newToken = null;
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
