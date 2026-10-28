export default function buildWaves(n: number, deps: number[][]): number {
  const waiting = new Array<number>(n).fill(0);
  const dependents: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of deps as [number, number][]) {
    waiting[a]!++;
    dependents[b]!.push(a);
  }
  let wave = waiting.flatMap((w, i) => (w === 0 ? [i] : []));
  let built = 0;
  let waves = 0;
  while (wave.length) {
    waves++;
    built += wave.length;
    const next: number[] = [];
    for (const m of wave) for (const d of dependents[m]!) if (--waiting[d]! === 0) next.push(d);
    wave = next;
  }
  return built === n ? waves : -1;
}
