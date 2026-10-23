import { parsePoints } from '#lib/domain/points.js';
import { normalizeNickname } from '#lib/nickname.js';
import { normalizeReason, REASON_MAX_LENGTH, REASON_TOO_LONG } from '#lib/reason.js';
import { error, type ActionOutcome, type ErrorResult } from './action-outcome.js';
import { conflictMessage } from './conflict-message.js';
import { judgeClaim, scoreWithoutClaim, type JudgeResult, type Verdict } from './db/judging.js';
import { readId, readString } from './form.js';

/** What a judging action returns under `judge`. Scored points are after clamping. */
export type JudgeFormResult =
	{ kind: 'scored'; points: number } | { kind: 'rejected' } | ErrorResult;

type JudgeOutcome = ActionOutcome<JudgeFormResult>;

const NO_NICKNAME = 'Set your nickname first, so everyone knows who judged this.';
const NOT_POINTS = 'Enter a whole number of points.';

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

async function judge(
	db: D1Database,
	gameId: number,
	data: FormData,
	judgedBy: string,
	verdict: Verdict
): Promise<JudgeOutcome> {
	const from = data.get('from') === 'scored' ? 'scored' : 'pending';
	// A team can undo only a pending claim. A scored one goes only with its challenge on re-import.
	const notFound =
		from === 'pending'
			? 'The team undid this claim before it was judged.'
			: 'This claim is not in this game any more. Reload the page.';
	const claimId = readId(data, 'claimId');
	if (claimId === null) return error(404, notFound);
	return toOutcome(await judgeClaim(db, gameId, { claimId, from, verdict, judgedBy }), notFound);
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
