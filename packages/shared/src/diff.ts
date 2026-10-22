export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string };

/** Splits into words and the whitespace between them, so joining the parts restores the text. */
function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

/**
 * Word-level diff (longest common subsequence). Adjacent parts of the same kind are merged.
 * Inputs are capped by document limits, so the O(n·m) table stays small.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const width = b.length + 1;
  // lcs[i * width + j] = length of the LCS of a[i..] and b[j..]
  const lcs = new Uint32Array((a.length + 1) * width);
  const at = (i: number, j: number) => lcs[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }

  const parts: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text = '') => {
    const last = parts.at(-1);
    if (last?.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      push('removed', a[i++]);
    } else {
      push('added', b[j++]);
    }
  }
  while (i < a.length) push('removed', a[i++]);
  while (j < b.length) push('added', b[j++]);
  return parts;
}
