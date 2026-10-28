export default function calmStreak(readings: number[], k: number): number {
  if (readings.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < readings.length; i++) {
    run = Math.abs(readings[i]! - readings[i - 1]!) <= k ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}
