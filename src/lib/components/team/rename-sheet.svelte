<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { GAME_DATA } from '#lib/live-updates.js';
	import { TEAM_NAME_MAX_LENGTH } from '#lib/team-name.js';
	import { actionFailureMessage } from './action-message.js';
	import type { GameClock } from './game-clock.svelte.js';

	type Props = { open: boolean; name: string; clock: GameClock; onclose: () => void };

	let { open, name, clock, onclose }: Props = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	function close() {
		error = null;
		onclose();
	}
</script>

<Sheet.Root {open} onOpenChange={(isOpen) => !isOpen && close()}>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>Rename team</Sheet.Title>
			<Sheet.Description>Everyone sees the new name, the organiser included.</Sheet.Description>
		</Sheet.Header>
		{#key open}
			<form
				method="POST"
				action="?/rename"
				class="flex flex-col gap-4"
				use:enhance={() => {
					busy = true;
					error = null;
					return async ({ result }) => {
						await invalidate(GAME_DATA).catch(() => {});
						busy = false;
						error = actionFailureMessage(result, clock.closedMessageFor);
						if (error) return;
						close();
						toast.show('Renamed');
					};
				}}
			>
				<div class="flex flex-col gap-2">
					<Label for="team-name">Team name</Label>
					<Input
						id="team-name"
						name="name"
						required
						maxlength={TEAM_NAME_MAX_LENGTH}
						value={name}
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? 'team-name-error' : undefined}
					/>
					{#if error}
						<p id="team-name-error" class="text-[15px] text-danger" role="alert">{error}</p>
					{/if}
				</div>
				<Button type="submit" variant="primary" size="lg" disabled={busy}>Save name</Button>
			</form>
		{/key}
	</Sheet.Content>
</Sheet.Root>
