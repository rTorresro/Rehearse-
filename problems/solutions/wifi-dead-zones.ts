export default function deadZones(grid: string[], range: number): number {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const seen = grid.map((row) => [...row].map(() => false));
  let queue: [number, number][] = [];
  grid.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === "R") {
        seen[r]![c] = true;
        queue.push([r, c]);
      }
    }),
  );
  // multi-source BFS, one ring of distance per round
  for (let d = 0; d < range && queue.length; d++) {
    const next: [number, number][] = [];
    for (const [r, c] of queue) {
      for (const [nr, nc] of [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ] as const) {
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (grid[nr]![nc] === "#" || seen[nr]![nc]) continue;
        seen[nr]![nc] = true;
        next.push([nr, nc]);
      }
    }
    queue = next;
  }
  let dead = 0;
  grid.forEach((row, r) => [...row].forEach((ch, c) => ch === "." && !seen[r]![c] && dead++));
  return dead;
}
