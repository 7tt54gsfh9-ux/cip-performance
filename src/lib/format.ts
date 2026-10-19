export const fmt = (n: number | null | undefined, d = 0) =>
  n == null || !isFinite(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
