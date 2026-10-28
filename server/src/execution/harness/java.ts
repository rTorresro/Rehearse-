import type { FunctionSignature, ValueType } from "@rehearse/shared";
import { usesTree } from "./util.js";

const JAVA_TYPE: Record<ValueType, string> = {
  int: "int",
  "int[]": "int[]",
  "int[][]": "int[][]",
  string: "String",
  "string[]": "String[]",
  bool: "boolean",
  tree: "TreeNode",
};

const CONVERT: Record<ValueType, string> = {
  int: "RehearseConv.toInt",
  "int[]": "RehearseConv.toIntArray",
  "int[][]": "RehearseConv.toIntMatrix",
  string: "RehearseConv.toStr",
  "string[]": "RehearseConv.toStrArray",
  bool: "RehearseConv.toBool",
  tree: "RehearseConv.toTree",
};

// only emitted when the problem has a tree; TreeNode doesn't exist otherwise
const TREE_CONVERTER = `  @SuppressWarnings("unchecked")
  static TreeNode toTree(Object o) {
    java.util.List<Object> v = (java.util.List<Object>) o;
    if (v.isEmpty() || v.get(0) == null) return null;
    TreeNode root = new TreeNode(toInt(v.get(0)));
    java.util.ArrayList<TreeNode> queue = new java.util.ArrayList<>();
    queue.add(root);
    int k = 1;
    for (int h = 0; h < queue.size() && k < v.size(); h++) {
      TreeNode node = queue.get(h);
      if (k < v.size()) { Object x = v.get(k++); if (x != null) { node.left = new TreeNode(toInt(x)); queue.add(node.left); } }
      if (k < v.size()) { Object x = v.get(k++); if (x != null) { node.right = new TreeNode(toInt(x)); queue.add(node.right); } }
    }
    return root;
  }

`;

// Judge0 compiles a single Main.java, so everything lives in one file: the user's classes
// first (their imports have to lead the file), then ours. ours use fully qualified names
// so they don't depend on what the user imported
export function javaProgram(sig: FunctionSignature, code: string, marker: string) {
  // only Main may be public in Main.java
  const userCode = code.replace(/\bpublic\s+(final\s+)?class\s+Solution\b/, "$1class Solution");
  const needTree = usesTree(sig) && !/\bclass\s+TreeNode\b/.test(userCode);
  const decls = sig.params
    .map((p, i) => `    ${JAVA_TYPE[p.type]} a${i} = ${CONVERT[p.type]}(args.get(${i}));`)
    .join("\n");
  const call = `new Solution().${sig.name}(${sig.params.map((_, i) => `a${i}`).join(", ")})`;

  return `${userCode}
${
  needTree
    ? `
class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}
`
    : ""
}
public class Main {
  @SuppressWarnings("unchecked")
  public static void main(String[] argv) throws Exception {
    String in = new String(System.in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
    java.util.List<Object> args = (java.util.List<Object>) new RehearseJson(in).parse();
${decls}
    Object result = ${call};
    System.out.flush();
    System.out.print("\\n" + ${JSON.stringify(marker)} + RehearseConv.json(result) + "\\n");
    System.out.flush();
  }
}

// just enough JSON for test values: null, booleans, integers, strings, arrays
class RehearseJson {
  private final String s;
  private int i = 0;
  RehearseJson(String s) { this.s = s; }

  Object parse() {
    ws();
    char c = s.charAt(i);
    if (c == '[') {
      i++;
      java.util.List<Object> list = new java.util.ArrayList<>();
      ws();
      if (s.charAt(i) == ']') { i++; return list; }
      while (true) {
        list.add(parse());
        ws();
        if (s.charAt(i++) == ']') return list;
      }
    }
    if (c == '"') return str();
    if (s.startsWith("null", i)) { i += 4; return null; }
    if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
    if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
    int start = i;
    while (i < s.length() && "-+0123456789".indexOf(s.charAt(i)) >= 0) i++;
    return Long.parseLong(s.substring(start, i));
  }

  private String str() {
    StringBuilder b = new StringBuilder();
    i++;
    while (true) {
      char c = s.charAt(i++);
      if (c == '"') return b.toString();
      if (c != '\\\\') { b.append(c); continue; }
      char e = s.charAt(i++);
      switch (e) {
        case 'n': b.append('\\n'); break;
        case 't': b.append('\\t'); break;
        case 'r': b.append('\\r'); break;
        case 'b': b.append('\\b'); break;
        case 'f': b.append('\\f'); break;
        case 'u': b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
        default: b.append(e);
      }
    }
  }

  private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
}

class RehearseConv {
  static int toInt(Object o) { return ((Long) o).intValue(); }
  static String toStr(Object o) { return (String) o; }
  static boolean toBool(Object o) { return (Boolean) o; }

  @SuppressWarnings("unchecked")
  static int[] toIntArray(Object o) {
    java.util.List<Object> l = (java.util.List<Object>) o;
    int[] a = new int[l.size()];
    for (int k = 0; k < a.length; k++) a[k] = toInt(l.get(k));
    return a;
  }

  @SuppressWarnings("unchecked")
  static int[][] toIntMatrix(Object o) {
    java.util.List<Object> l = (java.util.List<Object>) o;
    int[][] a = new int[l.size()][];
    for (int k = 0; k < a.length; k++) a[k] = toIntArray(l.get(k));
    return a;
  }

  @SuppressWarnings("unchecked")
  static String[] toStrArray(Object o) {
    java.util.List<Object> l = (java.util.List<Object>) o;
    String[] a = new String[l.size()];
    for (int k = 0; k < a.length; k++) a[k] = (String) l.get(k);
    return a;
  }

${usesTree(sig) ? TREE_CONVERTER : ""}
  // whatever they returned (arrays, boxed numbers, Lists) as compact JSON
  static String json(Object o) {
    StringBuilder b = new StringBuilder();
    write(b, o);
    return b.toString();
  }

  private static void write(StringBuilder b, Object o) {
    if (o == null) { b.append("null"); return; }
    if (o instanceof Boolean || o instanceof Integer || o instanceof Long || o instanceof Short || o instanceof Byte) { b.append(o); return; }
    if (o instanceof Character || o instanceof CharSequence) { quote(b, o.toString()); return; }
    if (o instanceof int[]) { int[] a = (int[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(a[k]); } b.append(']'); return; }
    if (o instanceof long[]) { long[] a = (long[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(a[k]); } b.append(']'); return; }
    if (o instanceof boolean[]) { boolean[] a = (boolean[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(a[k]); } b.append(']'); return; }
    if (o instanceof Object[]) { Object[] a = (Object[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); write(b, a[k]); } b.append(']'); return; }
    if (o instanceof Iterable) { b.append('['); boolean first = true; for (Object x : (Iterable<?>) o) { if (!first) b.append(','); first = false; write(b, x); } b.append(']'); return; }
    quote(b, o.toString());
  }

  private static void quote(StringBuilder b, String s) {
    b.append('"');
    for (int k = 0; k < s.length(); k++) {
      char c = s.charAt(k);
      if (c == '"' || c == '\\\\') b.append('\\\\').append(c);
      else if (c == '\\n') b.append("\\\\n");
      else if (c == '\\t') b.append("\\\\t");
      else if (c == '\\r') b.append("\\\\r");
      else if (c < 0x20) b.append(String.format("\\\\u%04x", (int) c));
      else b.append(c);
    }
    b.append('"');
  }
}
`;
}
