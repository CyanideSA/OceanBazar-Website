import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(24, 'JWT_ACCESS_SECRET must be at least 24 chars'),
  JWT_REFRESH_SECRET: z.string().min(24, 'JWT_REFRESH_SECRET must be at least 24 chars'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  JWT_SECRET_KEY: z.string().default('oceanbazar-secret-key-change-in-production'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  ADMIN_URL: z.string().default('http://localhost:4000'),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  REDIS_URL: z.string().optional(),
  TRUST_PROXY: z.string().optional(),

  // ─── Microsoft 365 (Graph API) ──────────────────────────────────────────
  MS_TENANT_ID: z.string().optional(),
  MS_CLIENT_ID: z.string().optional(),
  MS_CLIENT_SECRET: z.string().optional(),
  MS_SENDER_ADDRESSES: z.string().optional(),
  MS_DEFAULT_SENDER: z.string().optional(),
  MS_SUPPORT_SENDER: z.string().optional(),

  // ─── Admin SSO (Entra ID / Google Workspace) ─────────────────────────────
  MS_SSO_CLIENT_ID: z.string().optional(),
  MS_SSO_CLIENT_SECRET: z.string().optional(),
  MS_SSO_REDIRECT_URI: z.string().optional(),
  ADMIN_SSO_ALLOWED_DOMAINS: z.string().optional(),
  ADMIN_GOOGLE_CLIENT_ID: z.string().optional(),
  ADMIN_GOOGLE_CLIENT_SECRET: z.string().optional(),
  ADMIN_GOOGLE_REDIRECT_URI: z.string().optional(),
  ADMIN_GOOGLE_HOSTED_DOMAIN: z.string().optional(),

  // ─── Content ID tool (contentid.oceanbazar.com.bd) ───────────────────────
  CONTENT_ID_APP_URL: z.string().optional(),
  MS_CONTENT_ID_REDIRECT_URI: z.string().optional(),

  // ─── Meta Business Suite ─────────────────────────────────────────────────
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_PAGE_ACCESS_TOKEN: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_IG_ID: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),
  META_CATALOG_ID: z.string().optional(),
  META_SCHEDULER: z.string().optional(),
  META_OAUTH_REDIRECT_URI: z.string().optional(),

  // ─── WhatsApp Business Cloud API ─────────────────────────────────────────
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_TEMPLATE_ORDER: z.string().optional(),
  WHATSAPP_TEMPLATE_SHIPPING: z.string().optional(),

  // ─── Microsoft Teams alerts ──────────────────────────────────────────────
  TEAMS_WEBHOOK_URL: z.string().optional(),

  // ─── Google services ─────────────────────────────────────────────────────
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GA4_PROPERTY_ID: z.string().optional(),
  GSC_SITE_URL: z.string().optional(),
  GMC_MERCHANT_ID: z.string().optional(),
  RECAPTCHA_PROJECT_ID: z.string().optional(),
  RECAPTCHA_API_KEY: z.string().optional(),
  RECAPTCHA_SITE_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // ─── AI / ML service ─────────────────────────────────────────────────────
  ML_SERVICE_URL: z.string().optional(),
  ML_SERVICE_API_KEY: z.string().optional(),
  ML_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${formatted}`);
}

export const env = parsed.data;

