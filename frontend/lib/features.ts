/**
 * Public storefront feature switches.
 *
 * Live chat is opt-in so a missing environment variable cannot accidentally
 * expose an unfinished support channel.
 */
export const LIVE_CHAT_ENABLED =
  process.env.NEXT_PUBLIC_LIVE_CHAT_ENABLED === 'true';
