-- Key of the claim's photo or video in the MEDIA R2 bucket. Its extension names the type.
ALTER TABLE claim ADD COLUMN media_key TEXT;
