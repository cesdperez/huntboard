<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { TeamAvatar } from '#lib/components/images/index.js';
	import { nickname } from '#lib/components/nickname/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { GameClock } from '#lib/client/game-clock.svelte.js';
	import { NICKNAME_MAX_LENGTH } from '#lib/domain/nickname.js';
	import { normalizeTeamName, TEAM_NAME_MAX_LENGTH } from '#lib/domain/team-name.js';
	import AvatarForm from './avatar-form.svelte';
	import HowToPlay from './how-to-play.svelte';
	import { TeamAction } from './team-action.svelte.js';

	type Props = {
		gameName: string;
		team: { name: string; members: string; avatarKey: string | null };
		clock: GameClock;
		onstart: () => void;
	};

	let { gameName, team, clock, onstart }: Props = $props();

	let name = $state(untrack(() => nickname.value ?? ''));
	let nameInvalid = $state(false);
	// Null until the player types, so the field follows a rename by a teammate meanwhile.
	let teamDraft = $state<string | null>(null);

	const action = new TeamAction(
		() => clock,
		() => team.name
	);

	const start: SubmitFunction = (submission) => {
		nameInvalid = !nickname.save(name);
		if (nameInvalid) return submission.cancel();
		// Only a changed name is sent, so teammates who just press Start never overwrite each other.
		if (normalizeTeamName(submission.formData.get('name')) === team.name) {
			submission.cancel();
			onstart();
			return;
		}
		return action.submit(
			'Team name saved',
			onstart,
			(formData) => () => team.name === normalizeTeamName(formData.get('name'))
		)(submission);
	};
</script>

<section aria-labelledby="onboarding-heading" class="flex flex-col gap-8">
	<div class="flex flex-col gap-1">
		<h1 id="onboarding-heading" class="type-title break-words">
			Welcome to <bdi>{gameName}</bdi>!
		</h1>
		<p class="type-body break-words">
			You're on <b class="font-semibold"><bdi>{team.name}</bdi></b>.
		</p>
	</div>

	<form
		id="team-onboarding"
		method="POST"
		action="?/rename"
		class="flex flex-col gap-2"
		use:enhance={start}
	>
		<Label for="onboarding-name">Your name</Label>
		<p id="onboarding-name-help" class="type-secondary">
			Your own name, not the team name. Your team and the judge see it on what you mark.
		</p>
		<Input
			id="onboarding-name"
			bind:value={name}
			required
			maxlength={NICKNAME_MAX_LENGTH}
			autocomplete="nickname"
			aria-invalid={nameInvalid || undefined}
			aria-describedby={nameInvalid
				? 'onboarding-name-help onboarding-name-error'
				: 'onboarding-name-help'}
		/>
		{#if nameInvalid}
			<p id="onboarding-name-error" class="text-[15px] text-danger" role="alert">
				Type your name to continue.
			</p>
		{/if}
	</form>

	<section aria-labelledby="onboarding-team-heading" class="flex flex-col gap-3">
		<div class="flex flex-col gap-1">
			<h2 id="onboarding-team-heading" class="type-heading">
				Your team <span class="type-secondary">(optional)</span>
			</h2>
			<p class="type-secondary">The team name is shared. Anyone on the team can change it.</p>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="onboarding-team-name">Team name</Label>
			<Input
				id="onboarding-team-name"
				form="team-onboarding"
				name="name"
				required
				maxlength={TEAM_NAME_MAX_LENGTH}
				value={teamDraft ?? team.name}
				oninput={(event) => (teamDraft = event.currentTarget.value)}
				aria-invalid={action.error ? true : undefined}
				aria-describedby={action.error ? 'onboarding-team-error' : undefined}
			/>
			<!-- The rename action replaces the members line too, so it must go back unchanged. -->
			<input type="hidden" form="team-onboarding" name="members" value={team.members} />
			{#if action.error}
				<p id="onboarding-team-error" class="text-[15px] text-danger" role="alert">
					{action.error}
				</p>
			{/if}
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<TeamAvatar name={team.name} avatarKey={team.avatarKey} class="size-12 text-[20px]" />
			<AvatarForm avatarKey={team.avatarKey} {clock} />
		</div>
	</section>

	<section aria-labelledby="onboarding-steps-heading" class="flex flex-col gap-3">
		<h2 id="onboarding-steps-heading" class="type-heading">How to play</h2>
		<HowToPlay {clock} />
	</section>

	<Button type="submit" form="team-onboarding" variant="primary" size="lg" busy={action.busy}>
		Start playing
	</Button>
</section>
