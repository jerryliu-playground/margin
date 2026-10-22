/** Tone presets (SPEC feature 11): one click sends a plain request; fixes still come as proposals. */
export const TONE_PRESETS = [
  { label: 'More formal', prompt: 'Make the longest paragraph more formal. Propose the edit.' },
  { label: 'Shorter', prompt: 'Make the longest paragraph shorter. Propose the edit.' },
  { label: 'Friendlier', prompt: 'Make the longest paragraph friendlier. Propose the edit.' },
] as const;
