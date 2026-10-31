<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { gameLinks } from '#lib/client/game-links.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { formatJoinCode, joinCodeOf } from '#lib/domain/join-code.js';
	import type { GameRow, SetupTeam } from '#lib/server/db/types.js';
	import { cn } from '#lib/utils.js';
	import { captainMessage, whatsAppLink } from './captain-message.js';
	import { ClipboardCopy } from './clipboard-copy.svelte.js';

	let { game, team }: { game: GameRow; team: SetupTeam } = $props();

	// Set in the browser only, because the start time shows in the admin's time zone.
	let now = $state<Date | null>(null);
	onMount(() => {
		now = new Date();
	});

	const message = $derived.by(() => {
		if (!now) return null;
		const links = gameLinks(page.url.href);
		return captainMessage(
			{
				gameName: game.name,
				teamName: team.name,
				teamLink: links.team(team.token),
				joinPage: links.joinPage,
				joinCode: formatJoinCode(joinCodeOf(team.token)),
				startsAt: game.starts_at
			},
			now
		);
	});

	const clipboard = new ClipboardCopy();

	const status = $derived(
		clipboard.state === 'copied'
			? 'Message copied.'
			: clipboard.state === 'blocked'
				? 'Copying is blocked here. Use "Send on WhatsApp", or open the page in another browser.'
				: ''
	);
</script>

<div class="flex flex-col">
	<p class="type-secondary">Message the captain</p>
	<div class="mt-2 flex flex-wrap gap-3">
		<Button
			href={message ? whatsAppLink(message) : undefined}
			disabled={!message}
			target="_blank"
			rel="noopener noreferrer"
		>
			Send on WhatsApp<span class="sr-only"> to the captain of {team.name}</span>
		</Button>
		<Button disabled={!message} onclick={() => message && clipboard.copy(message)}>
			{clipboard.state === 'copied' ? 'Copied' : 'Copy'}<span class="sr-only">
				message for the captain of {team.name}</span
			>
		</Button>
	</div>
	<p class={cn('type-secondary', status && 'mt-2')} role="status">{status}</p>
</div>
