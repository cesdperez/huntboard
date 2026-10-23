-- No query needs it, and SQLite picked it over claim_challenge_id, scanning every scored claim.
DROP INDEX claim_status_marked_at;
