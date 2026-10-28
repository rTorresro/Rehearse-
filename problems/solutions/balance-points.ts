export default function balancePoints(nums: number[]): number[] {
  const total = nums.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let left = 0;
  nums.forEach((x, i) => {
    if (left === total - left - x) out.push(i);
    left += x;
  });
  return out;
}
