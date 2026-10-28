export default function reconcile(shipped: string[], received: string[]): string[] {
  const net = new Map<string, number>();
  for (const sku of received) net.set(sku, (net.get(sku) ?? 0) + 1);
  for (const sku of shipped) net.set(sku, (net.get(sku) ?? 0) - 1);
  return [...net]
    .filter(([, d]) => d !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([sku, d]) => `${sku}:${d > 0 ? "+" : "-"}${Math.abs(d)}`);
}
