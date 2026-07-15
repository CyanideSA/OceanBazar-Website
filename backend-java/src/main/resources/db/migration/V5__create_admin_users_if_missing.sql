-- Historical alignment migration:
-- Existing environments already recorded version 5 ("create admin users if missing")
-- but this file was missing from source control.
--
-- Keep this migration intentionally idempotent and side-effect free so Flyway
-- history is consistent across environments without forcing unsafe default users.
SELECT 1;
