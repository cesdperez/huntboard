<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import type { GameClock } from '#lib/game-clock.svelte.js';
	import { TEAM_MEMBERS_MAX_LENGTH, TEAM_NAME_MAX_LENGTH } from '#lib/team-name.js';
	import { TeamAction } from './team-action.svelte.js';

	type Props = {
		open: boolean;
		name: string;
		members: string;
		clock: GameClock;
		onclose: () => void;
	};

	let { open, name, members, clock, onclose }: Props = $props();

	const action = new TeamAction(() => clock);

	function close() {
		action.clearError();
		onclose();
	}
</script>

<Sheet.Root {open} onOpenChange={(isOpen) => !isOpen && close()}>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>Edit team</Sheet.Title>
			<Sheet.Description
				>Everyone sees the name and members, the organiser included.</Sheet.Description
			>
		</Sheet.Header>
		{#key open}
			<form
				method="POST"
				action="?/rename"
				class="flex flex-col gap-4"
				use:enhance={action.submit('Saved', close)}
			>
				<div class="flex flex-col gap-2">
					<Label for="team-name">Team name</Label>
					<Input
						id="team-name"
						name="name"
						required
						maxlength={TEAM_NAME_MAX_LENGTH}
						value={name}
						aria-invalid={action.error ? true : undefined}
						aria-describedby={action.error ? 'team-name-error' : undefined}
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="team-members">Members</Label>
					<Input
						id="team-members"
						name="members"
						maxlength={TEAM_MEMBERS_MAX_LENGTH}
						placeholder="César, Kos, Martin"
						value={members}
					/>
					{#if action.error}
						<p id="team-name-error" class="text-[15px] text-danger" role="alert">
							{action.error}
						</p>
					{/if}
				</div>
				<Button type="submit" variant="primary" size="lg" disabled={action.busy}>Save</Button>
			</form>
		{/key}
	</Sheet.Content>
</Sheet.Root>
