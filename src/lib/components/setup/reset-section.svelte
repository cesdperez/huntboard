<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { GameRow } from '#lib/server/db/types.js';
	import { updateOrRetry } from './update-or-retry.js';

	let { game }: { game: GameRow } = $props();

	let pending = $state(false);

	const submit: SubmitFunction = ({ cancel }) => {
		const warning = `Reset ${game.name}? This deletes every team, challenge, claim and score, and team links stop working. It cannot be undone.`;
		if (!confirm(warning)) {
			cancel();
			return;
		}
		pending = true;
		return async (settled) => {
			await updateOrRetry(settled);
			pending = false;
			if (settled.result.type === 'success') toast.show('Game reset');
		};
	};
</script>

<section aria-labelledby="reset-heading" class="flex flex-col gap-3">
	<h2 id="reset-heading" class="font-display type-heading">Reset</h2>
	<p id="reset-hint" class="type-secondary">
		Start over with a blank game. Deletes all teams, challenges, claims and scores, and clears the
		times and late penalty. The game name, the theme and the admin and scoreboard links stay.
	</p>
	<form method="POST" action="?/gameSettingsReset" use:enhance={submit}>
		<Button
			type="submit"
			variant="destructive"
			class="w-full"
			disabled={pending}
			aria-describedby="reset-hint"
		>
			Reset game
		</Button>
	</form>
</section>
