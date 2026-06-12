-- Security: session-version token revocation, TOTP 2FA, login audit log.

ALTER TABLE users ADD COLUMN token_version     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_secret       TEXT;            -- base32 (pending or active)
ALTER TABLE users ADD COLUMN totp_enabled      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_backup_codes TEXT;            -- JSON array of SHA-256 hashes

CREATE TABLE IF NOT EXISTS auth_events (
  id         TEXT PRIMARY KEY,
  org_id     TEXT,
  user_id    TEXT,
  email      TEXT,
  event_type TEXT NOT NULL,   -- login_success|login_failure|login_2fa_required|login_2fa_failure|logout|logout_all|password_change|sessions_revoked|2fa_enabled|2fa_disabled
  ip         TEXT,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_events_org ON auth_events(org_id, created_at);
