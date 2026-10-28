export type TreeNode = { val: number; left: TreeNode | null; right: TreeNode | null };

// level order with null for missing children, the format the problem JSON uses
export function buildTree(values: (number | null)[]): TreeNode | null {
  if (values.length === 0 || values[0] === null || values[0] === undefined) return null;
  const node = (val: number): TreeNode => ({ val, left: null, right: null });
  const root = node(values[0]);
  const queue = [root];
  let i = 1;
  for (let head = 0; head < queue.length && i < values.length; head++) {
    const parent = queue[head]!;
    for (const side of ["left", "right"] as const) {
      if (i >= values.length) break;
      const v = values[i++];
      if (v !== null && v !== undefined) {
        parent[side] = node(v);
        queue.push(parent[side]);
      }
    }
  }
  return root;
}
