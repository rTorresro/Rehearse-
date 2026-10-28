export default function mergeSlots(slots: number[][]): number[][] {
  const sorted = [...slots].sort((a, b) => a[0]! - b[0]!);
  const merged: number[][] = [];
  for (const [start, end] of sorted as [number, number][]) {
    const last = merged.at(-1);
    // touching counts as overlapping, hence <=
    if (last && start <= last[1]!) last[1] = Math.max(last[1]!, end);
    else merged.push([start, end]);
  }
  return merged;
}
