<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LinksFormResult } from '#lib/server/actions/links.js';
	import type { GameRow, TeamWithClaimCount } from '#lib/server/db/types.js';
	import LinkRow from './link-row.svelte';

	let { game, teams }: { game: GameRow; teams: TeamWithClaimCount[] } = $props();

	const result = $derived(page.form?.links as LinksFormResult | undefined);

	// resolve() returns a path relative to the current page during SSR, so anchor it to the page URL.
	const absolute = (path: string) => new URL(path, page.url.href).href;
</script>

<section aria-labelledby="links-heading" class="flex flex-col gap-3">
	<h2 id="links-heading" class="type-heading">Links</h2>
	<p class="type-secondary">
		Anyone with a link can use it. Rotate a link to shut out whoever has the old one.
	</p>

	{#if result?.error}
		<p class="text-[15px] text-danger" role="alert">{result.error}</p>
	{/if}

	<ul class="flex flex-col border-t border-line">
		<LinkRow
			id="link-admin"
			label="Admin"
			hint="Judge claims and change the game. Keep it to organisers. Rotating moves you to the new link."
			url={absolute(resolve('/a/[token]', { token: game.admin_token }))}
			action="linksRotateAdmin"
		/>
		<LinkRow
			id="link-scoreboard"
			label="Scoreboard"
			hint="Read only. Put it on a big screen or share it with spectators."
			url={absolute(resolve('/s/[token]', { token: game.scoreboard_token }))}
			action="linksRotateScoreboard"
			rotated={result?.rotated === 'scoreboard'}
		/>
		{#each teams as team (team.id)}
			<LinkRow
				id="link-team-{team.id}"
				label={team.name}
				hint="Team page. Everyone in the team can mark challenges done."
				url={absolute(resolve('/t/[token]', { token: team.token }))}
				action="linksRotateTeam"
				teamId={team.id}
				rotated={result?.rotated === `team-${team.id}`}
			/>
		{/each}
	</ul>

	{#if teams.length === 0}
		<p class="type-secondary">Add a team to get its link.</p>
	{/if}
</section>
