-- A theme id from src/lib/themes. An id no longer registered reads as the default theme.
ALTER TABLE game ADD COLUMN theme TEXT NOT NULL DEFAULT 'flag';
