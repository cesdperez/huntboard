<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { onMount, tick } from 'svelte';
	import { forgetRecentGame, recentGames, type RecentGame } from '#lib/client/recent-games.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { isolate } from '#lib/format/text.js';

	let { class: className }: { class?: string } = $props();

	// Empty on the server, which cannot see this browser's storage.
	let games = $state<RecentGame[]>([]);
	let list = $state<HTMLElement | null>(null);
	onMount(() => {
		games = recentGames();
	});

	function role(game: RecentGame): string {
		if (game.kind === 'admin') return 'Admin';
		if (game.kind === 'scoreboard') return 'Scoreboard';
		return game.teamName ? `Team ${isolate(game.teamName)}` : 'Team';
	}

	async function forget(index: number) {
		forgetRecentGame(games[index].path);
		games = recentGames();
		await tick();
		const buttons = list?.querySelectorAll<HTMLElement>('button');
		buttons?.[Math.min(index, buttons.length - 1)]?.focus();
	}
</script>

{#if games.length > 0}
	<section aria-labelledby="recent-games-heading" class={className}>
		<h2 id="recent-games-heading" class="font-semibold">Continue where you left off</h2>
		<ul bind:this={list} class="mt-1 flex flex-col">
			{#each games as game, index (game.path)}
				<li class="flex items-center gap-2 border-b border-ink/20 last:border-b-0">
					<!-- Every stored path was made by resolve() on the page that recorded it. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={game.path}
						class="flex min-h-touch min-w-0 flex-1 flex-col justify-center py-1 underline-offset-4 hover:underline"
					>
						<span class="truncate font-semibold">{isolate(game.gameName)}</span>
						<span class="truncate text-[15px] leading-snug">{role(game)}</span>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<Button
						variant="ghost"
						size="icon"
						aria-label="Forget {isolate(game.gameName)}, {role(game)}"
						onclick={() => forget(index)}
					>
						<XIcon aria-hidden="true" />
					</Button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
