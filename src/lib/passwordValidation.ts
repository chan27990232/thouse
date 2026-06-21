export const PASSWORD_REQUIREMENTS_HINT =
  '密碼須至少 8 個字元，並包含大寫字母、小寫字母、數字及符號。';

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return '密碼至少需要 8 個字元。';
  }
  if (!/[a-z]/.test(password)) {
    return '密碼須包含小寫字母。';
  }
  if (!/[A-Z]/.test(password)) {
    return '密碼須包含大寫字母。';
  }
  if (!/[0-9]/.test(password)) {
    return '密碼須包含數字。';
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return '密碼須包含符號（例如 !@#$%）。';
  }
  return null;
}
