import { describe, expect, it } from 'vitest';
import {
	claimConflictMessage,
	claimLine,
	rejectedRowLine,
	claimsClosedMessage,
	emptyQueueMessage,
	judgedClaimMessage
} from './claim-messages.js';

const RLO = 'bb \u202egpj.exe';
const ISOLATED = '\u2068bb \u202egpj.exe\u2069';

describe('names and notes from players and judges', () => {
	it('are isolated, so an override in one cannot reverse the message', () => {
		expect(
			claimConflictMessage({ status: 'pending', markedBy: RLO, judgedBy: null, points: null })
		).toBe(`${ISOLATED} already marked this done.`);
		expect(
			claimConflictMessage({ status: 'scored', markedBy: 'Sam', judgedBy: RLO, points: 5 })
		).toBe(`${ISOLATED} already scored this: 5 points.`);
		expect(
			claimLine({ status: 'scored', markedBy: 'Sam', markedAt: '', judgedBy: RLO }, String, true)
		).toBe(`Judged by ${ISOLATED}.`);
		expect(
			judgedClaimMessage(RLO, { status: 'rejected', points: null, judgeNote: RLO }, false)
		).toBe(`Rejected ${ISOLATED}: ${ISOLATED}.`);
		expect(rejectedRowLine(RLO, false)).toBe(`Rejected: ${ISOLATED}`);
	});
});

describe('claimConflictMessage', () => {
	it('names the teammate who already marked it', () => {
		expect(
			claimConflictMessage({ status: 'pending', markedBy: 'Sam', judgedBy: null, points: null })
		).toBe('Sam already marked this done.');
	});

	it('names the judge and the points of a scored claim', () => {
		expect(
			claimConflictMessage({ status: 'scored', markedBy: 'Sam', judgedBy: 'Alex', points: 15 })
		).toBe('Alex already scored this: 15 points.');
	});

	it('uses the singular for one point', () => {
		expect(
			claimConflictMessage({ status: 'scored', markedBy: 'Sam', judgedBy: 'Alex', points: 1 })
		).toBe('Alex already scored this: 1 point.');
	});

	it('names the judge of a rejected claim', () => {
		expect(
			claimConflictMessage({ status: 'rejected', markedBy: 'Sam', judgedBy: 'Alex', points: null })
		).toBe('Alex already rejected this.');
	});

	it('falls back to "A judge" when no judge name was kept', () => {
		expect(
			claimConflictMessage({ status: 'rejected', markedBy: 'Sam', judgedBy: null, points: null })
		).toBe('A judge already rejected this.');
	});
});

describe('claimsClosedMessage', () => {
	const window = { startsAt: '2026-06-01T16:00:00.000Z', endsAt: '2026-06-01T21:00:00.000Z' };
	const formatTime = (iso: string) => `<${iso.slice(11, 16)}>`;

	it('says when the game ended and that claims are closed', () => {
		expect(claimsClosedMessage('after', window, formatTime)).toBe(
			'The game ended at <21:00>. Claims are closed.'
		);
	});

	it('says when the game starts and that claims open then', () => {
		expect(claimsClosedMessage('before', window, formatTime)).toBe(
			'The game starts at <16:00>. Claims open then.'
		);
	});

	it('says the game has no time yet when it is not scheduled', () => {
		expect(claimsClosedMessage('before', { ...window, startsAt: null }, formatTime)).toBe(
			'The game has no start time yet. Claims open once it starts.'
		);
	});

	it('says the end time is missing when only the start is set', () => {
		expect(claimsClosedMessage('before', { ...window, endsAt: null }, formatTime)).toBe(
			'The game has no end time yet. Claims open once the organiser sets it.'
		);
	});
});

describe('claimLine', () => {
	const formatTime = (iso: string) => `<${iso.slice(11, 16)}>`;
	const claim = {
		status: 'pending' as const,
		markedBy: 'Sam',
		markedAt: '2026-06-01T17:02:00.000Z',
		judgedBy: null
	};

	it('says who marked a pending claim and when', () => {
		expect(claimLine(claim, formatTime, true)).toBe('Marked done by Sam at <17:02>.');
	});

	it('names the judge of a scored claim', () => {
		expect(claimLine({ ...claim, status: 'scored', judgedBy: 'Alex' }, formatTime, true)).toBe(
			'Judged by Alex.'
		);
	});

	it('has no line for a scored claim without a judge name', () => {
		expect(claimLine({ ...claim, status: 'scored' }, formatTime, true)).toBeNull();
	});

	it('names the judge of a rejected claim and says it can be marked again', () => {
		expect(claimLine({ ...claim, status: 'rejected', judgedBy: 'Alex' }, formatTime, true)).toBe(
			'Alex rejected this. You can mark it done again.'
		);
	});

	it('falls back to "A judge" on a rejected claim without a judge name', () => {
		expect(claimLine({ ...claim, status: 'rejected' }, formatTime, true)).toBe(
			'A judge rejected this. You can mark it done again.'
		);
	});

	it('offers no new claim once claims are closed', () => {
		expect(claimLine({ ...claim, status: 'rejected', judgedBy: 'Alex' }, formatTime, false)).toBe(
			'Alex rejected this.'
		);
	});
});

describe('rejectedRowLine', () => {
	it('shows the reason when the judge gave one', () => {
		expect(rejectedRowLine('blurry', true)).toBe('Rejected: blurry');
	});

	it('offers a new claim while claims are open', () => {
		expect(rejectedRowLine(null, true)).toBe('Rejected. You can mark it done again.');
	});

	it('offers no new claim once claims are closed', () => {
		expect(rejectedRowLine(null, false)).toBe('Rejected.');
	});
});

describe('emptyQueueMessage', () => {
	it('says claims arrive once the game starts', () => {
		expect(emptyQueueMessage('before')).toBe(
			'Nothing to judge yet. Claims show up here once the game starts.'
		);
	});

	it('invites the next claim while the game runs', () => {
		expect(emptyQueueMessage('during')).toBe('Nothing to judge. New claims show up here.');
	});

	it('says no claims come in after the end', () => {
		expect(emptyQueueMessage('after')).toBe(
			'Nothing left to judge. The game has ended, so no new claims come in.'
		);
	});

	it('invites the next claim while the browser clock has not started', () => {
		expect(emptyQueueMessage(null)).toBe('Nothing to judge. New claims show up here.');
	});
});
