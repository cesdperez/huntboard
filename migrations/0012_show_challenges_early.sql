-- 1 lets teams see the challenges before the start. 0 hides them until the game starts.
ALTER TABLE game ADD COLUMN show_challenges_early INTEGER NOT NULL DEFAULT 0;
