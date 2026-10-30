import { clampPoints, parsePoints } from '#lib/domain/points.js';
import { normalizeNickname } from '#lib/domain/nickname.js';
import { normalizeReason, REASON_MAX_LENGTH, REASON_TOO_LONG } from '#lib/domain/reason.js';
import { error, type ActionOutcome, type ErrorResult } from './action-outcome.js';
import { conflictMessage } from './conflict-message.js';
import {
	getActiveRangedClaim,
	getRangedClaim,
	judgeClaim,
	scoreWithoutClaim,
	type JudgeResult,
	type RangedClaimRow,
	type Verdict
} from '../db/judging.js';
import { readId, readString } from './form.js';

/**
 * What a judging action returns under `judge`. Scored points are after clamping. Unchanged comes
 * only from a check: the claim is still as the judge saw it.
 */
export type JudgeFormResult =
	{ kind: 'scored'; points: number } | { kind: 'rejected' } | { kind: 'unchanged' } | ErrorResult;

type JudgeOutcome = ActionOutcome<JudgeFormResult>;

const NO_NICKNAME = 'Set your nickname first, so everyone knows who judged this.';
const NOT_POINTS = 'Enter a whole number of points.';
// Says nothing about the cause: an undo and a re-import that deletes the challenge both remove claims.
const CLAIM_GONE = 'This claim is not in this game any more. Reload the page.';

/** Scores a claim the judge saw as `from`: pending (first judge wins) or scored (a fix). */
export async function scoreClaim(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<JudgeOutcome> {
	const score = readScore(data);
	if (isRefusal(score)) return score;
	return judge(db, gameId, data, score.judgedBy, { status: 'scored', points: score.points });
}

export async function rejectClaim(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<JudgeOutcome> {
	const judgeName = readJudge(data);
	if (isRefusal(judgeName)) return judgeName;
	const reason = normalizeReason(readString(data, 'reason'));
	if (reason.length > REASON_MAX_LENGTH) return error(400, REASON_TOO_LONG);
	return judge(db, gameId, data, judgeName.judgedBy, {
		status: 'rejected',
		reason: reason || null
	});
}

const OPEN_CELL_GONE = 'That team or challenge is not in this game any more. Reload the page.';

/** Scores a challenge for a team that never marked it, for proof that arrived in person. */
export async function scoreOpenCell(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<JudgeOutcome> {
	const score = readScore(data);
	if (isRefusal(score)) return score;
	const teamId = readId(data, 'teamId');
	const challengeId = readId(data, 'challengeId');
	if (teamId === null || challengeId === null) return error(404, OPEN_CELL_GONE);
	const result = await scoreWithoutClaim(db, gameId, { teamId, challengeId, ...score });
	return toOutcome(result, OPEN_CELL_GONE);
}

/**
 * Tells a judge whose answer was lost what their judgement did, changing nothing: scored or
 * rejected when it went through, unchanged when the claim is still as they saw it, or who got
 * there first. verdict is 'scored' or 'rejected'; the other fields are the judgement's own.
 */
export async function checkJudgement(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<JudgeOutcome> {
	const rejecting = data.get('verdict') === 'rejected';
	const sent = rejecting ? readJudge(data) : readScore(data);
	if (isRefusal(sent)) return sent;
	const claimId = readId(data, 'claimId');
	if (claimId !== null) {
		const claim = await getRangedClaim(db, gameId, claimId);
		if (!claim) return error(404, CLAIM_GONE);
		const from = data.get('from') === 'scored' ? 'scored' : 'pending';
		return checked(claim, sent, claim.status === from);
	}
	const teamId = readId(data, 'teamId');
	const challengeId = readId(data, 'challengeId');
	if (teamId === null || challengeId === null) return error(404, OPEN_CELL_GONE);
	const claim = await getActiveRangedClaim(db, gameId, teamId, challengeId);
	return claim ? checked(claim, sent, false) : UNCHANGED;
}

const UNCHANGED: JudgeOutcome = { status: 200, result: { kind: 'unchanged' } };

function checked(
	claim: RangedClaimRow,
	sent: { judgedBy: string; points?: number },
	asSeen: boolean
): JudgeOutcome {
	const verdict = sent.points === undefined ? 'rejected' : 'scored';
	const points =
		sent.points === undefined
			? null
			: clampPoints(sent.points, { min: claim.min_points, max: claim.max_points });
	if (claim.judged_by === sent.judgedBy && claim.status === verdict && claim.points === points) {
		return toOutcome({ status: 'judged', claim }, CLAIM_GONE);
	}
	return asSeen ? UNCHANGED : error(409, conflictMessage(claim));
}

async function judge(
	db: D1Database,
	gameId: number,
	data: FormData,
	judgedBy: string,
	verdict: Verdict
): Promise<JudgeOutcome> {
	const from = data.get('from') === 'scored' ? 'scored' : 'pending';
	const id = readId(data, 'claimId');
	if (id === null) return error(404, CLAIM_GONE);
	const claim = { id, team_id: readId(data, 'teamId'), challenge_id: readId(data, 'challengeId') };
	return toOutcome(await judgeClaim(db, gameId, { claim, from, verdict, judgedBy }), CLAIM_GONE);
}

type Refusal = ActionOutcome<ErrorResult>;

function isRefusal<T extends object>(read: T | Refusal): read is Refusal {
	return 'status' in read;
}

function readJudge(data: FormData): { judgedBy: string } | Refusal {
	const judgedBy = normalizeNickname(data.get('nickname'));
	return judgedBy ? { judgedBy } : error(400, NO_NICKNAME);
}

function readScore(data: FormData): { judgedBy: string; points: number } | Refusal {
	const judgeName = readJudge(data);
	if (isRefusal(judgeName)) return judgeName;
	const points = parsePoints(readString(data, 'points'));
	return points === null ? error(400, NOT_POINTS) : { judgedBy: judgeName.judgedBy, points };
}

function toOutcome(result: JudgeResult, notFound: string): JudgeOutcome {
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
