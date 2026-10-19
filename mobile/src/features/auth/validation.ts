/** Mirrors the API constraints so most mistakes are caught before a round trip. */
export const NICKNAME_PATTERN = /^[\p{L}\p{N}_.-]{3,20}$/u;
export const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthField = 'email' | 'password' | 'nickname';

export function validateEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function validatePassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= 128;
}

export function validateNickname(nickname: string): boolean {
  return NICKNAME_PATTERN.test(nickname.trim());
}

/** Which form field a server error code belongs to, if any. */
export function fieldForErrorCode(code: string): AuthField | null {
  switch (code) {
    case 'email_taken':
      return 'email';
    case 'nickname_taken':
    case 'nickname_forbidden':
      return 'nickname';
    default:
      return null;
  }
}
