-- Times are UTC ISO-8601 text in Date.prototype.toISOString() format.

CREATE TABLE game (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	admin_token TEXT NOT NULL UNIQUE,
	scoreboard_token TEXT NOT NULL UNIQUE,
	starts_at TEXT,
	ends_at TEXT,
	late_penalty_per_minute INTEGER NOT NULL DEFAULT 0 CHECK (late_penalty_per_minute >= 0),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

CREATE TABLE team (
	id INTEGER PRIMARY KEY,
	game_id INTEGER NOT NULL REFERENCES game (id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	token TEXT NOT NULL UNIQUE,
	position INTEGER NOT NULL,
	arrived_at TEXT
);

CREATE INDEX team_game_id ON team (game_id, position);

CREATE TABLE challenge (
	id INTEGER PRIMARY KEY,
	game_id INTEGER NOT NULL REFERENCES game (id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	description TEXT,
	section TEXT,
	min_points INTEGER NOT NULL CHECK (min_points >= 0),
	max_points INTEGER NOT NULL,
	position INTEGER NOT NULL,
	CHECK (min_points <= max_points)
);

-- Re-import matches challenges by title ignoring case, so two titles that differ only in case would be ambiguous.
CREATE UNIQUE INDEX challenge_game_title ON challenge (game_id, lower(title));

CREATE TABLE claim (
	id INTEGER PRIMARY KEY,
	team_id INTEGER NOT NULL REFERENCES team (id) ON DELETE CASCADE,
	-- Deleting a challenge on re-import deletes its claims after the admin confirms.
	challenge_id INTEGER NOT NULL REFERENCES challenge (id) ON DELETE CASCADE,
	status TEXT NOT NULL CHECK (status IN ('pending', 'scored', 'rejected')),
	note TEXT,
	marked_by TEXT NOT NULL,
	marked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	points INTEGER,
	judged_by TEXT,
	judged_at TEXT,
	judge_note TEXT,
	CHECK (status <> 'scored' OR points IS NOT NULL)
);

-- Rejected claims stay as history, so a team may claim the same challenge again after a rejection.
CREATE UNIQUE INDEX claim_active_team_challenge ON claim (team_id, challenge_id)
	WHERE status IN ('pending', 'scored');

CREATE INDEX claim_challenge_id ON claim (challenge_id);
CREATE INDEX claim_status_marked_at ON claim (status, marked_at);

CREATE TABLE adjustment (
	id INTEGER PRIMARY KEY,
	team_id INTEGER NOT NULL REFERENCES team (id) ON DELETE CASCADE,
	points INTEGER NOT NULL,
	reason TEXT NOT NULL,
	created_by TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX adjustment_team_id ON adjustment (team_id);
