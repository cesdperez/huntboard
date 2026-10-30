-- The browser sends a new random id with each adjustment, so resending one whose answer was lost adds nothing.
ALTER TABLE adjustment ADD COLUMN request_id TEXT;

CREATE UNIQUE INDEX adjustment_request_id ON adjustment (request_id) WHERE request_id IS NOT NULL;
