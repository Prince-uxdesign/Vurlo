/**
 * Random slug generation.
 *
 * - 32-character alphabet (no 0, 1, l or o lookalikes), so every random byte
 *   maps to a character with no modulo bias (256 / 32 = 8).
 * - 7 characters gives 32^7 ≈ 3.4e10 combinations: short enough to share,
 *   large enough that guessing valid slugs is impractical.
 * - Uses the Web Crypto CSPRNG, never Math.random or sequential ids.
 * - Uniqueness is guaranteed by the database constraint, not by this
 *   function. Callers must retry on a unique violation.
 */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";
export const GENERATED_SLUG_LENGTH = 7;

export function generateSlug(length: number = GENERATED_SLUG_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let slug = "";
  for (const byte of bytes) slug += ALPHABET[byte % ALPHABET.length];
  return slug;
}
