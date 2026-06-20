/** Next selectable index in a list that has non-selectable slots (dividers),
    wrapping in `step` direction. Returns `from` when nothing is selectable. Pass
    from = -1, step = 1 for the first item; from = length, step = -1 for the last. */
export function nextItemIndex(selectable: boolean[], from: number, step: 1 | -1): number {
  const n = selectable.length;
  if (n === 0) return -1;
  for (let i = 1; i <= n; i++) {
    const idx = (((from + step * i) % n) + n) % n;
    if (selectable[idx]) return idx;
  }
  return from;
}
