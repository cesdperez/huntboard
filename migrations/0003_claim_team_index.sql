-- Keeps a team's claims and a game's scoreboard inside one game, instead of scanning every game's claims.
CREATE INDEX claim_team_id ON claim (team_id, status);
