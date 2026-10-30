import { deserialize, type ActionResult } from '$app/forms';
import { resultUnder } from '#lib/action-results.js';

/**
 * Asks the server what a judgement whose answer was lost did, without changing anything. False
 * when the claim is still as the judge saw it, so the judgement did not go through. Otherwise the
 * answer it should have had: the verdict, or who got there first.
 */
export async function askWhatJudgementDid(
	sent: FormData,
	verdict: 'scored' | 'rejected'
): Promise<boolean | ActionResult> {
	const body = new FormData();
	for (const [name, value] of sent) body.append(name, value);
	body.set('verdict', verdict);
	const response = await fetch('?/judgeCheck', {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	const result = deserialize(await response.text());
	const judged = result.type === 'success' ? resultUnder(result.data, 'judge') : undefined;
	return judged?.kind === 'unchanged' ? false : result;
}
