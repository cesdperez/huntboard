-- Keys of objects in the IMAGES R2 bucket. A replaced image gets a new key, so its URL can be cached forever.
ALTER TABLE game ADD COLUMN image_key TEXT;
-- Names the game image for players and doubles as its alt text.
ALTER TABLE game ADD COLUMN image_label TEXT NOT NULL DEFAULT '';
ALTER TABLE team ADD COLUMN avatar_key TEXT;
