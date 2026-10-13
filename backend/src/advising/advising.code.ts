/**
 * Invite codes that link students to their Academic Advisor.
 *
 * Format: XXXX-XXXX, from an alphabet without look-alike characters
 * (no I, L, O, 0, 1), so a code read aloud or copied from a chat message
 * is hard to get wrong. 31^8 is about 850 billion combinations.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

function withDash(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * @param randomInt returns a uniformly random integer in [0, max). Pass a
 * cryptographic source (node:crypto randomInt) in production.
 */
export function generateInviteCode(randomInt: (max: number) => number): string {
  let raw = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    raw += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return withDash(raw);
}

/**
 * Turns what a student typed into the stored form, or null if it cannot be
 * a code. Case, spaces, and dashes are ignored: "ab2c 9kmp" -> "AB2C-9KMP".
 */
export function normalizeInviteCode(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const raw = input.toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== INVITE_CODE_LENGTH) {
    return null;
  }
  for (const character of raw) {
    if (!INVITE_CODE_ALPHABET.includes(character)) {
      return null;
    }
  }
  return withDash(raw);
}
