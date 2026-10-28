import type { FunctionSignature } from "@rehearse/shared";
import { usesTree } from "./util.js";

export function javascriptProgram(sig: FunctionSignature, code: string, marker: string) {
  const needTree = usesTree(sig) && !/\b(class|function)\s+TreeNode\b/.test(code);
  const args = sig.params.map((p, i) =>
    p.type === "tree" ? `__rhTree(__rhArgs[${i}])` : `__rhArgs[${i}]`,
  );

  return `${
    needTree
      ? `function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}
`
      : ""
  }
// run under its own file name so stack traces and syntax errors use the candidate's line numbers
require("vm").runInThisContext(${JSON.stringify(code)}, { filename: "solution.js" });

;(function () {
  function __rhTree(values) {
    if (!values.length || values[0] === null) return null;
    const root = new TreeNode(values[0]);
    const queue = [root];
    let i = 1;
    for (let h = 0; h < queue.length && i < values.length; h++) {
      for (const side of ["left", "right"]) {
        if (i >= values.length) break;
        const v = values[i++];
        if (v !== null) {
          queue[h][side] = new TreeNode(v);
          queue.push(queue[h][side]);
        }
      }
    }
    return root;
  }
  // a plain function, or LeetCode-style class Solution
  const fn =
    typeof ${sig.name} === "function"
      ? ${sig.name}
      : typeof Solution === "function" && typeof new Solution().${sig.name} === "function"
        ? (...a) => new Solution().${sig.name}(...a)
        : null;
  if (!fn) throw new Error("define a function named ${sig.name}");
  const __rhArgs = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const result = fn(${args.join(", ")});
  process.stdout.write("\\n" + ${JSON.stringify(marker)} + JSON.stringify(result === undefined ? null : result) + "\\n");
})();
`;
}
