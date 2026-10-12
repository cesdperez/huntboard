<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import DicesIcon from '@lucide/svelte/icons/dices';
	import { onMount } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { plural } from '#lib/plural.js';
	import type { TeamsFormResult } from '#lib/server/actions/teams.js';
	import type { GameRow, TeamWithClaimCount } from '#lib/server/db/types.js';
	import { TEAM_NAME_MAX_LENGTH } from '#lib/team-name.js';
	import { suggestTeamName } from '#lib/team-name-suggestion.js';
	import { updateOrRetry } from './update-or-retry.js';

	let { game, teams }: { game: GameRow; teams: TeamWithClaimCount[] } = $props();

	const result = $derived(page.form?.teams as TeamsFormResult | undefined);
	const addError = $derived(result?.error && result.teamId === undefined ? result.error : null);

	let editingId = $state<number | null>(null);
	let pending = $state(false);

	const initial = page.form?.teams as TeamsFormResult | undefined;
	let newName = $state(initial?.error && initial.teamId === undefined ? (initial.name ?? '') : '');

	const suggestNewName = () => (newName = suggestTeamName(teams.map((team) => team.name)));

	// Random on the client only, so the server render and hydration agree.
	onMount(() => {
		if (newName === '') suggestNewName();
	});

	const submitThen =
		(onSuccess?: () => void): SubmitFunction =>
		() => {
			pending = true;
			return async (settled) => {
				const { result } = settled;
				await updateOrRetry(settled);
				pending = false;
				if (result.type === 'success') {
					editingId = null;
					onSuccess?.();
				}
			};
		};

	const submit = submitThen();
	const submitAdd = submitThen(suggestNewName);

	function confirmDelete(team: TeamWithClaimCount): SubmitFunction {
		return (input) => {
			if (!confirm(`Delete ${team.name}? Its link stops working.`)) {
				input.cancel();
				return;
			}
			return submit(input);
		};
	}

	function rowError(team: TeamWithClaimCount) {
		return result?.error && result.teamId === team.id ? result.error : null;
	}
</script>

<section aria-labelledby="teams-heading" class="flex flex-col gap-4">
	<h2 id="teams-heading" class="type-heading">Teams</h2>

	{#if teams.length === 0}
		<p class="type-secondary">No teams yet. Add one for each group that gets its own link.</p>
	{:else}
		<ol class="flex flex-col border-t" aria-label="Teams in {game.name}">
			{#each teams as team, index (team.id)}
				{@const error = rowError(team)}
				<li class="flex flex-col gap-3 border-b py-2">
					{#if editingId === team.id}
						<form
							method="POST"
							action="?/teamsRename"
							class="flex flex-col gap-3 pt-2"
							use:enhance={submit}
						>
							<input type="hidden" name="teamId" value={team.id} />
							<Label for="team-name-{team.id}">Name</Label>
							<Input
								id="team-name-{team.id}"
								name="name"
								required
								maxlength={TEAM_NAME_MAX_LENGTH}
								value={error && result?.name !== undefined ? result.name : team.name}
								aria-invalid={error ? true : undefined}
								aria-describedby={error ? `team-error-${team.id}` : undefined}
							/>
							<div class="flex gap-3">
								<Button type="submit" class="flex-1" disabled={pending}>Save</Button>
								<Button variant="ghost" class="flex-1" onclick={() => (editingId = null)}>
									Cancel
								</Button>
							</div>
						</form>
						{#if team.claim_count === 0}
							<form method="POST" action="?/teamsDelete" use:enhance={confirmDelete(team)}>
								<input type="hidden" name="teamId" value={team.id} />
								<Button type="submit" variant="destructive" class="w-full" disabled={pending}>
									Delete team
								</Button>
							</form>
						{:else}
							<p class="type-secondary">
								{team.name} has {plural(team.claim_count, 'claim')}, so it cannot be deleted.
							</p>
						{/if}
					{:else}
						<div class="flex min-h-touch items-center gap-1">
							<div class="min-w-0 flex-1">
								<p class="truncate">{team.name}</p>
								{#if team.claim_count > 0}
									<p class="type-secondary tabular-nums">{plural(team.claim_count, 'claim')}</p>
								{/if}
							</div>
							<form method="POST" action="?/teamsMoveUp" use:enhance={submit}>
								<input type="hidden" name="teamId" value={team.id} />
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									disabled={pending || index === 0}
									aria-label="Move {team.name} up"
								>
									<ArrowUpIcon aria-hidden="true" />
								</Button>
							</form>
							<form method="POST" action="?/teamsMoveDown" use:enhance={submit}>
								<input type="hidden" name="teamId" value={team.id} />
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									disabled={pending || index === teams.length - 1}
									aria-label="Move {team.name} down"
								>
									<ArrowDownIcon aria-hidden="true" />
								</Button>
							</form>
							<Button
								variant="ghost"
								aria-label="Edit {team.name}"
								onclick={() => (editingId = team.id)}
							>
								Edit
							</Button>
						</div>
					{/if}
					{#if error}
						<p id="team-error-{team.id}" class="text-[15px] text-danger" role="alert">{error}</p>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	<form method="POST" action="?/teamsAdd" class="flex flex-col gap-2" use:enhance={submitAdd}>
		<Label for="new-team-name">New team</Label>
		<div class="flex gap-1">
			<Input
				id="new-team-name"
				name="name"
				required
				maxlength={TEAM_NAME_MAX_LENGTH}
				placeholder="Canal Rats"
				bind:value={newName}
				onfocus={(event) => event.currentTarget.select()}
				aria-invalid={addError ? true : undefined}
				aria-describedby={addError ? 'new-team-error' : undefined}
			/>
			<Button
				variant="ghost"
				size="icon"
				aria-label="Suggest another name"
				onclick={suggestNewName}
			>
				<DicesIcon aria-hidden="true" />
			</Button>
			<Button type="submit" class="ml-2" disabled={pending}>Add team</Button>
		</div>
		{#if addError}
			<p id="new-team-error" class="text-[15px] text-danger" role="alert">{addError}</p>
		{/if}
	</form>
</section>
