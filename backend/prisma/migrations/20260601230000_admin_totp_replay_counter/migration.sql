-- Track last accepted TOTP period so the same code cannot be reused (replay protection).
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS two_fa_last_counter INTEGER;
