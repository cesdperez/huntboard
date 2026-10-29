-- Every upload a team was given a signed URL for, attached or not, so the limits count
-- abandoned uploads too and a claim can take only a key signed for its own team.
CREATE TABLE media_upload (
	key TEXT PRIMARY KEY,
	team_id INTEGER NOT NULL REFERENCES team (id) ON DELETE CASCADE,
	size INTEGER NOT NULL CHECK (size > 0),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX media_upload_team_id ON media_upload (team_id);
