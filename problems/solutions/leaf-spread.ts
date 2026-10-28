import { buildTree, type TreeNode } from "./_tree.ts";

export default function leafSpread(values: (number | null)[]): number {
  const root = buildTree(values);
  if (!root) return 0;
  let min = Infinity;
  let max = -Infinity;
  // iterative so a 10^4 node chain can't blow the stack
  const stack: [TreeNode, number][] = [[root, 0]];
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    if (!node.left && !node.right) {
      min = Math.min(min, depth);
      max = Math.max(max, depth);
    }
    if (node.left) stack.push([node.left, depth + 1]);
    if (node.right) stack.push([node.right, depth + 1]);
  }
  return max - min;
}
