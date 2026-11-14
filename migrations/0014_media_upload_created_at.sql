-- Supports the site-wide cap on recent uploads.
CREATE INDEX media_upload_created_at ON media_upload (created_at);
