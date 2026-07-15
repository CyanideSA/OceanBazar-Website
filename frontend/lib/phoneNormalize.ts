const BD_DEFAULT = '+880';

export function normalizePhoneTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed || trimmed.includes('@')) return trimmed;

  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('88') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('0')) return `${BD_DEFAULT}${digits.slice(1)}`;

  return `${BD_DEFAULT}${digits}`;
}
