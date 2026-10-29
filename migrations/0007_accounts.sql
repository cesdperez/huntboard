-- Game creators sign in. Players, judges and spectators still use links and have no account.

CREATE TABLE user (
	id INTEGER PRIMARY KEY,
	-- Lowercase. The address is the account: a sign-in email sent to it proves who someone is.
	email TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A sign-in email not used yet. Its link or its code signs in once, then the row is deleted.
CREATE TABLE sign_in_request (
	-- Random. Only the browser that asked holds it, in a cookie, so the code works only there.
	id TEXT PRIMARY KEY,
	-- SHA-256 of the link's token in base64url, so a leaked table does not open accounts.
	token_hash TEXT NOT NULL UNIQUE,
	-- SHA-256 of the id and the code: the code alone has too few values to hide behind a hash.
	code_hash TEXT NOT NULL,
	email TEXT NOT NULL,
	next_path TEXT NOT NULL,
	code_attempts INTEGER NOT NULL DEFAULT 0,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX sign_in_request_email ON sign_in_request (email, created_at);

CREATE TABLE session (
	-- SHA-256 of the cookie's token in base64url, so a leaked table does not open sessions.
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
	expires_at TEXT NOT NULL
);

CREATE INDEX session_user_id ON session (user_id);

-- Null for games created before accounts, until a signed-in admin claims them.
ALTER TABLE game ADD COLUMN owner_user_id INTEGER REFERENCES user (id) ON DELETE SET NULL;

CREATE INDEX game_owner_user_id ON game (owner_user_id);
