export default function bestPair(prices: number[], budget: number): number {
  const p = [...prices].sort((a, b) => a - b);
  let best = -1;
  let lo = 0;
  let hi = p.length - 1;
  while (lo < hi) {
    const sum = p[lo]! + p[hi]!;
    if (sum <= budget) {
      best = Math.max(best, sum);
      lo++;
    } else hi--;
  }
  return best;
}
