import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please wait 5 minutes.' },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please slow down.' },
});

/** Throttle bulk admin reads (orders list/detail) to limit scraping / accidental export storms. */
export const adminOrderListingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many order requests. Please wait a moment.' },
});

/** Throttle admin mutating calls (POST/PUT/PATCH/DELETE) — pair with per-route auth. */
export const adminMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin changes. Please wait a moment.' },
});

/**
 * Throttle expensive intelligence-layer calls that hit the ML service / LLM
 * (AI generation, batch recompute, forecasts). Protects downstream cost + latency.
 */
export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

/** Throttle content-id product ID generation per IP. */
export const contentIdGenerateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many ID generation requests. Please wait a moment.' },
});

/** Throttle content-id catalog create endpoints. */
export const contentIdCatalogLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many catalog changes. Please wait a moment.' },
});
