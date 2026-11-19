export const HOME_TITLE = 'Huntboard | Scavenger Hunt App with a Live Scoreboard';
export const HOME_DESCRIPTION =
	'Run a team scavenger hunt from your phone. Create challenges, judge photo and video submissions, and share a live scoreboard. Players join in their browser.';

export const HUNT_STEPS = [
	{
		symbol: 'start',
		title: 'Write your challenges',
		text: 'Paste a list with a points range for each one. Set the start and end time, and a late penalty if you want one.'
	},
	{
		symbol: 1,
		title: 'Send each team its link',
		text: 'Players need no account. Each team gets a private link and a QR code, picks a nickname and starts.'
	},
	{
		symbol: 2,
		title: 'Judge claims as they arrive',
		text: 'Teams mark a challenge done and can attach a photo or video. You score it inside its range or reject it with a reason.'
	},
	{
		symbol: 'finish',
		title: 'Show the scoreboard',
		text: 'Put it on a big screen at the finish. Totals change as you judge, and a QR code lets everyone follow on their phone.'
	}
] as const;

export const HUNT_QUESTIONS = [
	{
		question: 'Do players need an account or an app?',
		answer:
			'Only the organiser needs to sign in. Players open their team link or scan its QR code in a browser. They can also enter the team’s join code and pick a nickname.'
	},
	{
		question: 'How do you score scavenger hunt challenges?',
		answer:
			'Set a point value or range for each challenge. When a team submits a claim, the organiser can review its photo or video, award points within the range, or reject the claim. The scoreboard updates as claims are scored.'
	},
	{
		question: 'Can spectators follow the scoreboard?',
		answer:
			'Yes. Open the scoreboard link on a big screen or share it with spectators. Its QR code also lets them follow on their phones. Spectators can see team totals, but they cannot see photos or videos submitted as evidence.'
	},
	{
		question: 'What if a team link gets shared with the wrong person?',
		answer:
			'Replace the link in the organiser’s setup screen. The old link and join code stop working immediately. Send the team its new link or code.'
	}
];
