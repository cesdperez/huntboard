import { parsePoints } from '#lib/domain/points.js';
import { normalizeNickname } from '#lib/nickname.js';
import { REASON_MAX_LENGTH } from '#lib/reason.js';
import { conflictMessage } from './conflict-message.js';
import { judgeClaim, scoreWithoutClaim, type JudgeResult, type Verdict } from './db/judging.js';
import { readId, readString } from './form.js';

/** What a judging action returns under `judge`. Scored points are after clamping. */
export type JudgeFormResult =
	{ kind: 'scored'; points: number } | { kind: 'rejected' } | { kind: 'error'; message: string };

export interface JudgeActionOutcome {
	status: number;
	result: JudgeFormResult;
}

const NO_NICKNAME = 'Set your nickname first, so everyone knows who judged this.';
const NOT_POINTS = 'Enter a whole number of points.';

/** Scores a claim the judge saw as `from`: pending (first judge wins) or scored (a fix). */
export async function scoreClaim(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<JudgeActionOutcome> {
	const judgedBy = normalizeNickname(data.get('nickname'));
	if (!judgedBy) return error(400, NO_NICKNAME);
	const points = parsePoints(readString(data, 'points'));
	if (points === null) return error(400, NOT_POINTS);
	return judge(db, gameId, data, judgedBy, { status: 'scored', points });
}

export async function rejectClaim(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<JudgeActionOutcome> {
	const judgedBy = normalizeNickname(data.get('nickname'));
	if (!judgedBy) return error(400, NO_NICKNAME);
	const reason = readString(data, 'reason');
	if (reason.length > REASON_MAX_LENGTH) {
		return error(400, `Keep the reason to at most ${REASON_MAX_LENGTH} characters.`);
	}
	return judge(db, gameId, data, judgedBy, { status: 'rejected', reason: reason || null });
}

/** Scores a challenge for a team that never marked it, for proof that arrived in person. */
export async function scoreOpenCell(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<JudgeActionOutcome> {
	const judgedBy = normalizeNickname(data.get('nickname'));
	if (!judgedBy) return error(400, NO_NICKNAME);
	const points = parsePoints(readString(data, 'points'));
	if (points === null) return error(400, NOT_POINTS);
	const teamId = readId(data, 'teamId');
	const challengeId = readId(data, 'challengeId');
	const result =
		teamId === null || challengeId === null
			? ({ status: 'not-found' } as const)
			: await scoreWithoutClaim(db, gameId, {
					teamId,
					challengeId,
					points,
					judgedBy
				});
	return respond(result, 'That team or challenge is not in this game any more. Reload the page.');
}

async function judge(
	db: D1Database,
	gameId: number,
	data: FormData,
	judgedBy: string,
	verdict: Verdict
): Promise<JudgeActionOutcome> {
	const claimId = readId(data, 'claimId');
	const from = data.get('from') === 'scored' ? 'scored' : 'pending';
	const result =
		claimId === null
			? ({ status: 'not-found' } as const)
			: await judgeClaim(db, gameId, { claimId, from, verdict, judgedBy });
	// A team can undo only a pending claim. A scored one goes only with its challenge on re-import.
	return respond(
		result,
		from === 'pending'
			? 'The team undid this claim before it was judged.'
			: 'This claim is not in this game any more. Reload the page.'
	);
}

function respond(result: JudgeResult, notFound: string): JudgeActionOutcome {
	switch (result.status) {
		case 'judged':
			return {
				status: 200,
				result:
					result.claim.status === 'scored'
						? { kind: 'scored', points: result.claim.points ?? 0 }
						: { kind: 'rejected' }
			};
		case 'conflict':
			return error(409, conflictMessage(result.claim));
		case 'not-found':
			return error(404, notFound);
	}
}

function error(status: number, message: string): JudgeActionOutcome {
	return { status, result: { kind: 'error', message } };
}
