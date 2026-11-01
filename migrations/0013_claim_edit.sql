-- Who last changed the note or media of a pending claim, and when. marked_at stays as it was,
-- so an edited claim keeps its place in the judge queue.
ALTER TABLE claim ADD COLUMN edited_by TEXT;
ALTER TABLE claim ADD COLUMN edited_at TEXT;
