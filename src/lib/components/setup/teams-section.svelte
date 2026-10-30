<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import DicesIcon from '@lucide/svelte/icons/dices';
	import { onMount, tick, untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import { resultUnder } from '#lib/action-results.js';
	import { focusIfLost } from '#lib/client/focus.js';
	import { TeamAvatar } from '#lib/components/images/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { plural } from '#lib/format/plural.js';
	import type { GameRow, SetupTeam } from '#lib/server/db/types.js';
	import { TEAM_MEMBERS_MAX_LENGTH, TEAM_NAME_MAX_LENGTH } from '#lib/domain/team-name.js';
	import { suggestTeamName } from '#lib/domain/team-name-suggestion.js';
	import { deleteTeamQuestion } from './delete-team-question.js';
	import { updateOrRetry } from './update-or-retry.js';

	let { game, teams }: { game: GameRow; teams: SetupTeam[] } = $props();

	const result = $derived(resultUnder(page.form, 'teams'));
	const addError = $derived(result?.error && result.teamId === undefined ? result.error : null);

	let editingId = $state<number | null>(null);
	let pending = $state(false);
	let editForm = $state<HTMLElement | null>(null);
	let heading = $state<HTMLElement | null>(null);

	// Focus follows the form in and back to its Edit button, so it never falls back to the page top.
	async function startEditing(teamId: number) {
		editingId = teamId;
		await tick();
		editForm?.focus();
	}

	async function stopEditing() {
		const teamId = editingId;
		editingId = null;
		await tick();
		// A deleted team takes its Edit button with it.
		if (teamId !== null) (document.getElementById(`team-edit-${teamId}`) ?? heading)?.focus();
	}

	// A move can take the focused button out of the page, or disable it at the end of the list.
	async function refocusMoved(teamId: number, direction: 'up' | 'down') {
		await tick();
		const moved = document.getElementById(`team-${direction}-${teamId}`);
		const other = document.getElementById(`team-${direction === 'up' ? 'down' : 'up'}-${teamId}`);
		if (moved instanceof HTMLButtonElement && moved.disabled) other?.focus();
		else focusIfLost(moved);
	}

	const initial = resultUnder(page.form, 'teams');
	const addFailed = initial?.error !== undefined && initial.teamId === undefined;
	let newName = $state(addFailed ? (initial?.name ?? '') : '');
	let newMembers = $state(addFailed ? (initial?.members ?? '') : '');

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
					void stopEditing();
					onSuccess?.();
				}
			};
		};

	const submit = submitThen();
	const submitMove = (teamId: number, direction: 'up' | 'down') =>
		submitThen(() => void refocusMoved(teamId, direction));
	const submitAdd = submitThen(() => {
		suggestNewName();
		newMembers = '';
	});

	function confirmDelete(team: SetupTeam): SubmitFunction {
		return (input) => {
			if (!confirm(deleteTeamQuestion(team))) {
				input.cancel();
				return;
			}
			return submit(input);
		};
	}

	function confirmRemoveAvatar(team: SetupTeam): SubmitFunction {
		return (input) => {
			if (!confirm(`Remove the picture of ${team.name}? The team can add a new one.`)) {
				input.cancel();
				return;
			}
			return submit(input);
		};
	}

	// Initials appear only once some team has a picture, so a game without pictures looks as before.
	const showAvatars = $derived(teams.some((team) => team.avatar_key));

	function rowError(team: SetupTeam) {
		return result?.error && result.teamId === team.id ? result.error : null;
	}
</script>

<section aria-labelledby="teams-heading" class="flex flex-col gap-4">
	<h2 bind:this={heading} id="teams-heading" tabindex="-1" class="font-display type-heading">
		Teams
	</h2>

	{#if teams.length === 0}
		<p class="type-secondary">No teams yet. Add one for each group that gets its own link.</p>
	{:else}
		<ol class="flex flex-col border-t" aria-label="Teams in {game.name}">
			{#each teams as team, index (team.id)}
				{@const error = rowError(team)}
				<li class="flex flex-col gap-3 border-b py-2">
					{#if editingId === team.id}
						<form
							bind:this={editForm}
							method="POST"
							action="?/teamsRename"
							tabindex="-1"
							aria-label="Edit {team.name}"
							class="flex flex-col gap-3 pt-2 outline-none"
							use:enhance={submit}
						>
							<input type="hidden" name="teamId" value={team.id} />
							<Label for="team-name-{team.id}">Name</Label>
							<Input
								id="team-name-{team.id}"
								name="name"
								required
								maxlength={TEAM_NAME_MAX_LENGTH}
								value={untrack(() =>
									error && result?.name !== undefined ? result.name : team.name
								)}
								aria-invalid={error ? true : undefined}
								aria-describedby={error ? `team-error-${team.id}` : undefined}
							/>
							<Label for="team-members-{team.id}">Members</Label>
							<Input
								id="team-members-{team.id}"
								name="members"
								maxlength={TEAM_MEMBERS_MAX_LENGTH}
								placeholder="César, Kos, Martin"
								value={untrack(() =>
									error && result?.members !== undefined ? result.members : team.members
								)}
							/>
							<div class="flex gap-3">
								<Button type="submit" class="flex-1" busy={pending}>Save</Button>
								<Button variant="ghost" class="flex-1" onclick={stopEditing}>Cancel</Button>
							</div>
						</form>
						{#if team.avatar_key}
							<form
								method="POST"
								action="?/teamsAvatarRemove"
								class="flex items-center gap-3"
								use:enhance={confirmRemoveAvatar(team)}
							>
								<input type="hidden" name="teamId" value={team.id} />
								<TeamAvatar name={team.name} avatarKey={team.avatar_key} class="size-12" />
								<Button type="submit" variant="destructive" class="flex-1" busy={pending}>
									Remove picture
								</Button>
							</form>
						{/if}
						{#if team.claim_count === 0}
							<form method="POST" action="?/teamsDelete" use:enhance={confirmDelete(team)}>
								<input type="hidden" name="teamId" value={team.id} />
								<Button type="submit" variant="destructive" class="w-full" busy={pending}>
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
							{#if showAvatars}
								<TeamAvatar
									name={team.name}
									avatarKey={team.avatar_key}
									class="mr-2 size-8 text-[15px]"
								/>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate">{team.name}</p>
								{#if team.members}<p class="truncate type-secondary">{team.members}</p>{/if}
								{#if team.claim_count > 0}
									<p class="type-secondary tabular-nums">{plural(team.claim_count, 'claim')}</p>
								{/if}
							</div>
							<form method="POST" action="?/teamsMoveUp" use:enhance={submitMove(team.id, 'up')}>
								<input type="hidden" name="teamId" value={team.id} />
								<Button
									id="team-up-{team.id}"
									type="submit"
									variant="ghost"
									size="icon"
									disabled={index === 0}
									busy={pending}
									aria-label="Move {team.name} up"
								>
									<ArrowUpIcon aria-hidden="true" />
								</Button>
							</form>
							<form
								method="POST"
								action="?/teamsMoveDown"
								use:enhance={submitMove(team.id, 'down')}
							>
								<input type="hidden" name="teamId" value={team.id} />
								<Button
									id="team-down-{team.id}"
									type="submit"
									variant="ghost"
									size="icon"
									disabled={index === teams.length - 1}
									busy={pending}
									aria-label="Move {team.name} down"
								>
									<ArrowDownIcon aria-hidden="true" />
								</Button>
							</form>
							<Button
								id="team-edit-{team.id}"
								variant="ghost"
								aria-label="Edit {team.name}"
								onclick={() => startEditing(team.id)}
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
			<Button type="submit" class="ml-2" busy={pending}>Add team</Button>
		</div>
		<Input
			name="members"
			maxlength={TEAM_MEMBERS_MAX_LENGTH}
			placeholder="Members: César, Kos, Martin"
			aria-label="Team members (optional)"
			bind:value={newMembers}
		/>
		{#if addError}
			<p id="new-team-error" class="text-[15px] text-danger" role="alert">{addError}</p>
		{/if}
	</form>
</section>
