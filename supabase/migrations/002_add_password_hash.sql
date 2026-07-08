-- Add password_hash to users table for email/password auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
