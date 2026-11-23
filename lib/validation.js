export function validateCredentials(input, mode = 'login') {
  const errors = {};
  const email = String(input.email ?? '').trim();
  const password = String(input.password ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (mode === 'signup' && (password.length < 12 || password.length > 128)) errors.password = 'Use a password between 12 and 128 characters.';
  if (mode === 'login' && (!password || password.length > 128)) errors.password = 'Enter your password.';
  if (mode === 'signup' && input.confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
  if (mode === 'signup' && String(input.name ?? '').trim().length > 100) errors.name = 'Name must be 100 characters or fewer.';
  return { ok: Object.keys(errors).length === 0, errors };
}
export function validateQuantity(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? { ok: true, value: number } : { ok: false, error: 'Quantity must be a non-negative whole number.' };
}
export function validateImage(file) {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!file || !allowed.has(file.type) || file.size > 1_572_864) return { ok: false, error: 'Choose a JPEG, PNG, or WebP image under 1.5 MB.' };
  return { ok: true };
}
