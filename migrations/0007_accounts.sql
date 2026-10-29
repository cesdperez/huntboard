-- Game creators sign in. Players, judges and spectators still use links and have no account.

CREATE TABLE user (
	id INTEGER PRIMARY KEY,
	display_name TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One way to sign in. Accounts are never linked by email: a second identity is added while signed in.
CREATE TABLE identity (
	id INTEGER PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
	-- 'test' identities come only from the dev server's test login.
	provider TEXT NOT NULL CHECK (provider IN ('google', 'passkey', 'test')),
	-- Google's sub claim, or the passkey's credential id in base64url.
	subject TEXT NOT NULL,
	-- What the account page shows: the Google email, or empty for a passkey.
	label TEXT NOT NULL DEFAULT '',
	-- Passkeys only: the COSE public key in base64url, the signature counter and the transports JSON.
	public_key TEXT,
	sign_count INTEGER,
	transports TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	UNIQUE (provider, subject),
	CHECK (provider <> 'passkey' OR (public_key IS NOT NULL AND sign_count IS NOT NULL))
);

CREATE INDEX identity_user_id ON identity (user_id);

CREATE TABLE session (
	-- SHA-256 of the cookie's token in hex, so a leaked table does not open sessions.
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
	expires_at TEXT NOT NULL
);

CREATE INDEX session_user_id ON session (user_id);

-- Null for games created before accounts, until a signed-in admin claims them.
ALTER TABLE game ADD COLUMN owner_user_id INTEGER REFERENCES user (id) ON DELETE SET NULL;

CREATE INDEX game_owner_user_id ON game (owner_user_id);
