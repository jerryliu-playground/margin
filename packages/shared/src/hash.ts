/**
 * Stable, synchronous hash of a block's text (FNV-1a, 32-bit, hex).
 * Used as a proposal's `baseHash` to detect that the block changed. Not for security.
 */
export function hashBlockText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
