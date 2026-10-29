-- teamNameKey(name) from team-name.ts. SQLite lower() folds only ASCII, so the key is stored, like challenge.title_key.
ALTER TABLE team ADD COLUMN name_key TEXT;

UPDATE team SET name_key = lower(name);

-- Setup links, the scoreboard and the media zip tell teams apart only by name.
CREATE UNIQUE INDEX team_game_name_key ON team (game_id, name_key);
