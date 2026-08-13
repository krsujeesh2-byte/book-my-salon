/**
 * Normalize an Indian mobile number to E.164 (+91XXXXXXXXXX) per spec section 16.
 * Strips spaces/hyphens/parens; assumes India (+91) when no country code is present.
 */
export function normalizePhoneIN(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');

  if (digits.startsWith('+91') && digits.length === 13) {
    return digits;
  }
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  throw new Error(`Could not normalize phone number: ${input}`);
}

export function isValidIndianMobile(input: string): boolean {
  try {
    const normalized = normalizePhoneIN(input);
    return /^\+91[6-9]\d{9}$/.test(normalized);
  } catch {
    return false;
  }
}

export function formatPhoneDisplay(e164: string): string {
  // +919876543210 -> +91 98765 43210
  const match = e164.match(/^\+91(\d{5})(\d{5})$/);
  if (!match) return e164;
  return `+91 ${match[1]} ${match[2]}`;
}
