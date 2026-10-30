-- Pages post ids they loaded up to a poll ago, and SQLite gives a new row the id of the deleted
-- highest one, so a stale page would act on a different row. Inserts into these tables pass an
-- explicit id above the highest one ever used, from nextId() in db/ids.ts.
-- AUTOINCREMENT would mean rebuilding the tables, and on D1 dropping the old team table runs its
-- ON DELETE CASCADE actions, deleting every claim.
CREATE TABLE id_high (
	name TEXT PRIMARY KEY,
	high INTEGER NOT NULL
);

INSERT INTO id_high (name, high)
SELECT 'team', coalesce(max(id), 0) FROM team
UNION ALL SELECT 'challenge', coalesce(max(id), 0) FROM challenge
UNION ALL SELECT 'claim', coalesce(max(id), 0) FROM claim
UNION ALL SELECT 'adjustment', coalesce(max(id), 0) FROM adjustment;

-- NEW.id is not defined before an insert that leaves the id to SQLite, so that is refused too.
CREATE TRIGGER team_id_unused BEFORE INSERT ON team
WHEN NEW.id IS NULL OR NEW.id <= (SELECT high FROM id_high WHERE name = 'team')
BEGIN
	SELECT RAISE(ABORT, 'team id already used');
END;

CREATE TRIGGER team_id_high AFTER INSERT ON team
BEGIN
	UPDATE id_high SET high = NEW.id WHERE name = 'team';
END;

CREATE TRIGGER challenge_id_unused BEFORE INSERT ON challenge
WHEN NEW.id IS NULL OR NEW.id <= (SELECT high FROM id_high WHERE name = 'challenge')
BEGIN
	SELECT RAISE(ABORT, 'challenge id already used');
END;

CREATE TRIGGER challenge_id_high AFTER INSERT ON challenge
BEGIN
	UPDATE id_high SET high = NEW.id WHERE name = 'challenge';
END;

CREATE TRIGGER claim_id_unused BEFORE INSERT ON claim
WHEN NEW.id IS NULL OR NEW.id <= (SELECT high FROM id_high WHERE name = 'claim')
BEGIN
	SELECT RAISE(ABORT, 'claim id already used');
END;

CREATE TRIGGER claim_id_high AFTER INSERT ON claim
BEGIN
	UPDATE id_high SET high = NEW.id WHERE name = 'claim';
END;

CREATE TRIGGER adjustment_id_unused BEFORE INSERT ON adjustment
WHEN NEW.id IS NULL OR NEW.id <= (SELECT high FROM id_high WHERE name = 'adjustment')
BEGIN
	SELECT RAISE(ABORT, 'adjustment id already used');
END;

CREATE TRIGGER adjustment_id_high AFTER INSERT ON adjustment
BEGIN
	UPDATE id_high SET high = NEW.id WHERE name = 'adjustment';
END;
