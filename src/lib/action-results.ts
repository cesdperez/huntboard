// Imported by the browser too, so everything from the server stays a type-only import.
import type { GameSettingsFormData } from '#lib/server/actions/game-settings.js';
import type { LinksFormResult } from '#lib/server/actions/links.js';
import type { ChallengesFormResult } from '#lib/server/use-cases/challenge-setup.js';
import type { GameImageFormResult } from '#lib/server/use-cases/images.js';
import type { JudgeFormResult } from '#lib/server/use-cases/judging.js';
import type { TeamFormResult } from '#lib/server/use-cases/team-play.js';
import type { TeamScoresFormResult } from '#lib/server/use-cases/team-scores.js';
import type { TeamsFormResult } from '#lib/server/use-cases/team-setup.js';

/** The key a form action puts its result under in `page.form`, and the result it puts there. */
export interface ActionResults {
	challenges: ChallengesFormResult;
	gameImage: GameImageFormResult;
	gameSettings: GameSettingsFormData;
	judge: JudgeFormResult;
	links: LinksFormResult;
	team: TeamFormResult;
	teamScores: TeamScoresFormResult;
	teams: TeamsFormResult;
}

export type ActionKey = keyof ActionResults;

/** Keys whose results have a `kind`, so a failure can carry `{ kind: 'error', message }`. */
export type KindResultKey = {
	[K in ActionKey]: ActionResults[K] extends { kind: string } ? K : never;
}[ActionKey];

/** The result an action put under key, read from `page.form` or an enhance result's data. */
export function resultUnder<K extends ActionKey>(
	data: Record<string, unknown> | null | undefined,
	key: K
): ActionResults[K] | undefined {
	return data?.[key] as ActionResults[K] | undefined;
}
