import type { FunctionSignature } from "@rehearse/shared";
import { snakeCase, usesTree } from "./util.js";

// the user's function plus a driver: read JSON args from stdin, call it, print the
// return value as JSON after the marker. helper names start with _rh_ to stay out of the way
export function pythonProgram(sig: FunctionSignature, code: string, marker: string) {
  const name = snakeCase(sig.name);
  const needTree = usesTree(sig) && !/^\s*class\s+TreeNode\b/m.test(code);
  const args = sig.params.map((p, i) =>
    p.type === "tree" ? `_rh_tree(_rh_args[${i}])` : `_rh_args[${i}]`,
  );

  return `from typing import *
import sys as _rh_sys, json as _rh_json
_rh_sys.setrecursionlimit(20000)
${
  needTree
    ? `
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
`
    : ""
}
# compiled under its own name so tracebacks and syntax errors use the candidate's line numbers
exec(compile(${JSON.stringify(code)}, "solution.py", "exec"), globals())

def _rh_tree(values):
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue, i = [root], 1
    for node in queue:
        if i >= len(values):
            break
        for side in ("left", "right"):
            if i < len(values):
                v = values[i]
                i += 1
                if v is not None:
                    child = TreeNode(v)
                    setattr(node, side, child)
                    queue.append(child)
    return root

# a plain function, or LeetCode-style class Solution if that's what they wrote
_rh_fn = globals().get(${JSON.stringify(name)})
if _rh_fn is None and "Solution" in globals():
    _rh_fn = getattr(Solution(), ${JSON.stringify(name)}, None) or getattr(Solution(), ${JSON.stringify(sig.name)}, None)
if _rh_fn is None:
    raise NameError("define a function named ${name}")
_rh_args = _rh_json.loads(_rh_sys.stdin.read())
_rh_result = _rh_fn(${args.join(", ")})
_rh_sys.stdout.flush()
_rh_sys.stdout.write("\\n" + ${JSON.stringify(marker)} + _rh_json.dumps(_rh_result, separators=(",", ":")) + "\\n")
`;
}
