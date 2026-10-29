// Imported by the browser too, so everything from the server stays a type-only import.
import type { ChallengesFormResult } from '#lib/server/use-cases/challenge-setup.js';
import type { ClaimFormResult } from '#lib/server/use-cases/claim-game.js';
import type { MediaFormResult } from '#lib/server/use-cases/claim-media.js';
import type { GameSettingsFormData } from '#lib/server/use-cases/game-settings.js';
import type { GameImageFormResult } from '#lib/server/use-cases/images.js';
import type { JudgeFormResult } from '#lib/server/use-cases/judging.js';
import type { LinksFormResult } from '#lib/server/use-cases/links.js';
import type { TeamFormResult } from '#lib/server/use-cases/team-play.js';
import type { TeamScoresFormResult } from '#lib/server/use-cases/team-scores.js';
import type { TeamsFormResult } from '#lib/server/use-cases/team-setup.js';

/** The key a form action puts its result under in `page.form`, and the result it puts there. */
export interface ActionResults {
	challenges: ChallengesFormResult;
	claim: ClaimFormResult;
	gameImage: GameImageFormResult;
	gameSettings: GameSettingsFormData;
	judge: JudgeFormResult;
	links: LinksFormResult;
	media: MediaFormResult;
	team: TeamFormResult;
	teamScores: TeamScoresFormResult;
	teams: TeamsFormResult;
}

export type ActionKey = keyof ActionResults;

/** Keys whose results include `{ kind: 'error', message }`, so a failure can carry a message. */
export type ErrorResultKey = {
	[K in ActionKey]: [Extract<ActionResults[K], { kind: 'error' }>] extends [never] ? never : K;
}[ActionKey];

/** The result an action put under key, read from `page.form` or an enhance result's data. */
export function resultUnder<K extends ActionKey>(
	data: Record<string, unknown> | null | undefined,
	key: K
): ActionResults[K] | undefined {
	return data?.[key] as ActionResults[K] | undefined;
}
