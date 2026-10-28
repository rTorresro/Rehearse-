import { buildTree, type TreeNode } from "./_tree.ts";

export default function heaviestLevel(values: (number | null)[]): number {
  const root = buildTree(values);
  if (!root) return -1;
  let level: TreeNode[] = [root];
  let best = -Infinity;
  let bestDepth = -1;
  for (let depth = 0; level.length > 0; depth++) {
    const sum = level.reduce((s, n) => s + n.val, 0);
    if (sum > best) {
      best = sum;
      bestDepth = depth;
    }
    level = level.flatMap((n) => [n.left, n.right].filter((c): c is TreeNode => c !== null));
  }
  return bestDepth;
}
