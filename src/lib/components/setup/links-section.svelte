<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { resultUnder } from '#lib/action-results.js';
	import { absoluteLink } from '#lib/client/absolute-link.js';
	import type { GameRow, SetupTeam } from '#lib/server/db/types.js';
	import LinkRow from './link-row.svelte';

	let { game, teams }: { game: GameRow; teams: SetupTeam[] } = $props();

	const result = $derived(resultUnder(page.form, 'links'));

	const absolute = (path: string) => absoluteLink(path, page.url.href);
</script>

{#if result?.error}
	<p class="text-[15px] text-danger" role="alert">{result.error}</p>
{/if}

<section aria-labelledby="team-links-heading" class="flex flex-col gap-3">
	<h2 id="team-links-heading" class="font-display type-heading">Teams</h2>
	{#if teams.length === 0}
		<p class="type-secondary">
			No teams yet, so there are no team links to share.
			<a
				href="{resolve('/a/[token]/setup', { token: game.admin_token })}#teams-heading"
				class="font-semibold text-ink underline underline-offset-2"
			>
				Add teams in Setup
			</a>
		</p>
	{:else}
		<ul class="flex flex-col border-t border-line">
			{#each teams as team (team.id)}
				<LinkRow
					id="link-team-{team.id}"
					label={team.name}
					hint="Team page. Everyone in the team can mark challenges done."
					url={absolute(resolve('/t/[token]', { token: team.token }))}
					joinToken={team.token}
					action="linksRotateTeam"
					teamId={team.id}
					rotated={result?.rotated === `team-${team.id}`}
				/>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="scoreboard-link-heading" class="flex flex-col gap-3">
	<h2 id="scoreboard-link-heading" class="font-display type-heading">Spectators</h2>
	<ul class="flex flex-col border-t border-line">
		<LinkRow
			id="link-scoreboard"
			label="Scoreboard"
			hint="Read only. Put it on a big screen or share it with spectators."
			url={absolute(resolve('/s/[token]', { token: game.scoreboard_token }))}
			action="linksRotateScoreboard"
			rotated={result?.rotated === 'scoreboard'}
		/>
	</ul>
</section>

<section aria-labelledby="admin-link-heading" class="flex flex-col gap-3">
	<h2 id="admin-link-heading" class="font-display type-heading">Judges</h2>
	<ul class="flex flex-col border-t border-line">
		<LinkRow
			id="link-admin"
			label="Admin"
			hint="Judge claims and change the game. Keep it to organisers. Rotating moves you to the new link."
			url={absolute(resolve('/a/[token]', { token: game.admin_token }))}
			action="linksRotateAdmin"
			rotated={page.state.adminLinkRotated === true}
		/>
	</ul>
</section>

<p class="type-secondary">
	Anyone with a link can use it. Rotate a link to shut out whoever has the old one.
</p>
