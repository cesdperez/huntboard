-- Key of the claim's photo or video in the MEDIA R2 bucket. Its extension names the type.
ALTER TABLE claim ADD COLUMN media_key TEXT;

-- Undo deletes the claim's object, so no two claims may share one: a team could otherwise
-- attach the key of a judged claim to a new one and undo it to delete the judges' evidence.
CREATE UNIQUE INDEX claim_media_key ON claim (media_key) WHERE media_key IS NOT NULL;
