/**
 * Canonical OceanBazar mailbox identities (.com.bd).
 * Keep in sync with MS_SENDER_ADDRESSES / Global Settings / M365 shared mailboxes.
 */

export const MAIL_NO_REPLY = 'no-reply@oceanbazar.com.bd';
export const MAIL_CONTACT = 'contact@oceanbazar.com.bd';
export const MAIL_BUSINESS = 'business@oceanbazar.com.bd';

export type MailIdentityKey = 'system' | 'care' | 'business';

export interface MailIdentity {
  key: MailIdentityKey;
  address: string;
  /** Inbox / From display name */
  displayName: string;
  /**
   * M365 mailbox avatar / theme icon only (NOT used in email HTML header).
   * Email headers always use the OceanBazar brand logo.
   */
  themeIconFile: string;
  /** Short header tagline under the brand logo */
  tagline: string;
}

/** Brand mark used in every outbound email header (CID + asset). */
export const MAIL_BRAND_LOGO_FILE = 'ob-brand-logo.png';
export const MAIL_BRAND_LOGO_CID = 'ob-brand-logo';

export const MAIL_IDENTITIES: Record<MailIdentityKey, MailIdentity> = {
  system: {
    key: 'system',
    address: MAIL_NO_REPLY,
    displayName: 'OceanBazar System',
    themeIconFile: 'ob-mail-system.png',
    tagline: 'OceanBazar System · Authentic international products',
  },
  care: {
    key: 'care',
    address: MAIL_CONTACT,
    displayName: 'OceanBazar Customer Care',
    themeIconFile: 'ob-mail-care.png',
    tagline: 'OceanBazar Customer Care · We are here to help',
  },
  business: {
    key: 'business',
    address: MAIL_BUSINESS,
    displayName: 'OceanBazar Business',
    themeIconFile: 'ob-mail-business.png',
    tagline: 'OceanBazar Business · Wholesale & partnerships',
  },
};

export const MAIL_FROM_DEFAULT = `${MAIL_IDENTITIES.system.displayName} <${MAIL_NO_REPLY}>`;

/** Extract bare email from `Name <email>` or plain address. */
export function extractEmailAddress(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const angle = s.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  if (s.includes('@')) return s.toLowerCase();
  return '';
}

export function resolveMailIdentity(from?: string | null): MailIdentity {
  const email = extractEmailAddress(from);
  if (email === MAIL_CONTACT || email === 'contact@oceanbazar.com') return MAIL_IDENTITIES.care;
  if (email === MAIL_BUSINESS || email === 'business@oceanbazar.com') return MAIL_IDENTITIES.business;
  if (email === MAIL_NO_REPLY || email === 'noreply@oceanbazar.com' || email === 'no-reply@oceanbazar.com') {
    return MAIL_IDENTITIES.system;
  }
  // Display-name hints (admin compose / misconfigured env)
  const lower = String(from || '').toLowerCase();
  if (lower.includes('customer care') || lower.includes('support')) return MAIL_IDENTITIES.care;
  if (lower.includes('business')) return MAIL_IDENTITIES.business;
  return MAIL_IDENTITIES.system;
}

export function formatMailFrom(identity: MailIdentity): string {
  return `${identity.displayName} <${identity.address}>`;
}

export function listMailIdentities(): MailIdentity[] {
  return [MAIL_IDENTITIES.system, MAIL_IDENTITIES.care, MAIL_IDENTITIES.business];
}
