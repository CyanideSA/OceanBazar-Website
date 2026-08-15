/**
 * Keep lite OTP/auth targets aligned with backend normalizePhoneTarget + email lowercasing.
 */

const BD_DEFAULT = '+880';

const DIGIT_MAP = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

function asciiDigits(value) {
  return String(value || '').replace(/[০-৯٠-٩]/g, (ch) => DIGIT_MAP[ch] || ch);
}

function normalizeAuthTarget(raw) {
  let target = String(raw || '').trim();
  if (!target) return '';
  if (target.includes('@')) return target.toLowerCase();

  target = asciiDigits(target);
  let digits = target.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('88') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('0')) return `${BD_DEFAULT}${digits.slice(1)}`;
  return `${BD_DEFAULT}${digits}`;
}

function normalizeOtpCode(raw) {
  return asciiDigits(raw).replace(/\s+/g, '').trim();
}

module.exports = {
  normalizeAuthTarget,
  normalizeOtpCode,
};
