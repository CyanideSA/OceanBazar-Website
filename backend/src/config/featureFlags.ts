import fs from 'fs';
import path from 'path';

export type FeatureFlagKey =
  | 'checkout_enabled'
  | 'payments_enabled'
  | 'admin_enabled'
  | 'wholesale_enabled'
  | 'realtime_enabled';

type FlagMap = Record<FeatureFlagKey, boolean>;

const DEFAULTS: FlagMap = {
  checkout_enabled: true,
  payments_enabled: true,
  admin_enabled: true,
  wholesale_enabled: true,
  realtime_enabled: true,
};

let cached: FlagMap | null = null;

function loadFromFile(): Partial<FlagMap> {
  const explicit = process.env.FEATURE_FLAGS_PATH?.trim();
  const candidates = [
    explicit,
    path.join(process.cwd(), 'config', 'feature-flags.json'),
    path.join(process.cwd(), '..', 'config', 'feature-flags.json'),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<FlagMap>;
        return raw;
      }
    } catch {
      /* try next */
    }
  }
  return {};
}

export function getFeatureFlags(): FlagMap {
  if (cached) return cached;
  const fromFile = loadFromFile();
  cached = {
    checkout_enabled: parseEnvBool('FEATURE_CHECKOUT_ENABLED', fromFile.checkout_enabled ?? DEFAULTS.checkout_enabled),
    payments_enabled: parseEnvBool('FEATURE_PAYMENTS_ENABLED', fromFile.payments_enabled ?? DEFAULTS.payments_enabled),
    admin_enabled: parseEnvBool('FEATURE_ADMIN_ENABLED', fromFile.admin_enabled ?? DEFAULTS.admin_enabled),
    wholesale_enabled: parseEnvBool('FEATURE_WHOLESALE_ENABLED', fromFile.wholesale_enabled ?? DEFAULTS.wholesale_enabled),
    realtime_enabled: parseEnvBool('FEATURE_REALTIME_ENABLED', fromFile.realtime_enabled ?? DEFAULTS.realtime_enabled),
  };
  return cached;
}

function parseEnvBool(key: string, fallback: boolean): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return getFeatureFlags()[flag];
}

export function reloadFeatureFlags(): void {
  cached = null;
}
