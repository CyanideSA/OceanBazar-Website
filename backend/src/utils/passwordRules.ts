/**
 * Password strength rules — enforced on both frontend and backend.
 * At least: 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 symbol
 */

export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter (A-Z)');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter (a-z)');
  if (!/\d/.test(password)) errors.push('At least one number (0-9)');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password))
    errors.push('At least one symbol (!@#$%^&*...)');

  return { valid: errors.length === 0, errors };
}
