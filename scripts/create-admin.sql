INSERT INTO admin_users (username, name, email, password_hash, role, active)
VALUES (
  'rjsuvosa',
  'RJ Suvosa',
  'rjsuvosa@oceanbazar.com',
  '$2a$10$jVD3YJ2rzdEfh4k9HGwmQe3xbMbzEizuex21XbUgmMRMFAZRZzI9.',
  'super_admin',
  true
)
ON CONFLICT (username) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      active = true
RETURNING id, username, role;
