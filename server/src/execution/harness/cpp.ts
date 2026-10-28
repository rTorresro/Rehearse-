import type { FunctionSignature, ValueType } from "@rehearse/shared";
import { usesTree } from "./util.js";

const CONVERT: Record<ValueType, string> = {
  int: "rehearse::toInt",
  "int[]": "rehearse::toIntVec",
  "int[][]": "rehearse::toIntMat",
  string: "rehearse::toStr",
  "string[]": "rehearse::toStrVec",
  bool: "rehearse::toBool",
  tree: "rehearse::toTree",
};

// explicit headers rather than <bits/stdc++.h>, so the same file builds on clang too.
// covers what LeetCode-style code usually assumes is already there
const INCLUDES = [
  "algorithm",
  "array",
  "bitset",
  "climits",
  "cmath",
  "cstdint",
  "cstring",
  "deque",
  "functional",
  "iostream",
  "iterator",
  "limits",
  "list",
  "map",
  "memory",
  "numeric",
  "queue",
  "set",
  "sstream",
  "stack",
  "string",
  "tuple",
  "unordered_map",
  "unordered_set",
  "utility",
  "vector",
];

export function cppProgram(sig: FunctionSignature, code: string, marker: string) {
  const needTree = usesTree(sig) && !/\bstruct\s+TreeNode\b|\bclass\s+TreeNode\b/.test(code);
  const decls = sig.params
    .map((p, i) => `  auto a${i} = ${CONVERT[p.type]}(rehearse_args.a[${i}]);`)
    .join("\n");
  const call = `rehearse_solution.${sig.name}(${sig.params.map((_, i) => `a${i}`).join(", ")})`;

  return `${INCLUDES.map((h) => `#include <${h}>`).join("\n")}
using namespace std;
${
  needTree
    ? `
struct TreeNode {
  int val;
  TreeNode *left;
  TreeNode *right;
  TreeNode() : val(0), left(nullptr), right(nullptr) {}
  TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
  TreeNode(int x, TreeNode *l, TreeNode *r) : val(x), left(l), right(r) {}
};
`
    : ""
}
// compiler errors point at the candidate's own lines, not ours
#line 1 "solution.cpp"
${code}
#line 1 "harness.cpp"

namespace rehearse {
// just enough JSON for test values: null, booleans, integers, strings, arrays
struct J {
  enum Kind { Null, Bool, Num, Str, Arr } kind = Null;
  bool b = false;
  long long n = 0;
  string s;
  vector<J> a;
};

struct Parser {
  const string &s;
  size_t i = 0;
  explicit Parser(const string &src) : s(src) {}
  void ws() { while (i < s.size() && isspace((unsigned char)s[i])) i++; }
  J parse() {
    ws();
    J v;
    if (s[i] == '[') {
      i++;
      v.kind = J::Arr;
      ws();
      if (s[i] == ']') { i++; return v; }
      while (true) {
        v.a.push_back(parse());
        ws();
        if (s[i++] == ']') return v;
      }
    }
    if (s[i] == '"') { v.kind = J::Str; v.s = str(); return v; }
    if (s.compare(i, 4, "null") == 0) { i += 4; return v; }
    if (s.compare(i, 4, "true") == 0) { i += 4; v.kind = J::Bool; v.b = true; return v; }
    if (s.compare(i, 5, "false") == 0) { i += 5; v.kind = J::Bool; return v; }
    size_t start = i;
    while (i < s.size() && (isdigit((unsigned char)s[i]) || s[i] == '-' || s[i] == '+')) i++;
    v.kind = J::Num;
    v.n = stoll(s.substr(start, i - start));
    return v;
  }
  string str() {
    string out;
    i++;
    while (true) {
      char c = s[i++];
      if (c == '"') return out;
      if (c != '\\\\') { out += c; continue; }
      char e = s[i++];
      if (e == 'n') out += '\\n';
      else if (e == 't') out += '\\t';
      else if (e == 'r') out += '\\r';
      else if (e == 'b') out += '\\b';
      else if (e == 'f') out += '\\f';
      else if (e == 'u') { out += (char)stoi(s.substr(i, 4), nullptr, 16); i += 4; }
      else out += e;
    }
  }
};

int toInt(const J &v) { return (int)v.n; }
bool toBool(const J &v) { return v.b; }
string toStr(const J &v) { return v.s; }
vector<int> toIntVec(const J &v) { vector<int> r; for (auto &x : v.a) r.push_back(toInt(x)); return r; }
vector<vector<int>> toIntMat(const J &v) { vector<vector<int>> r; for (auto &x : v.a) r.push_back(toIntVec(x)); return r; }
vector<string> toStrVec(const J &v) { vector<string> r; for (auto &x : v.a) r.push_back(x.s); return r; }
${
  usesTree(sig)
    ? `TreeNode *toTree(const J &v) {
  if (v.a.empty() || v.a[0].kind == J::Null) return nullptr;
  TreeNode *root = new TreeNode(toInt(v.a[0]));
  vector<TreeNode *> queue{root};
  size_t k = 1;
  for (size_t h = 0; h < queue.size() && k < v.a.size(); h++) {
    if (k < v.a.size()) { auto &x = v.a[k++]; if (x.kind != J::Null) { queue[h]->left = new TreeNode(toInt(x)); queue.push_back(queue[h]->left); } }
    if (k < v.a.size()) { auto &x = v.a[k++]; if (x.kind != J::Null) { queue[h]->right = new TreeNode(toInt(x)); queue.push_back(queue[h]->right); } }
  }
  return root;
}`
    : ""
}

void out(ostream &o, bool v) { o << (v ? "true" : "false"); }
void out(ostream &o, int v) { o << v; }
void out(ostream &o, long v) { o << v; }
void out(ostream &o, long long v) { o << v; }
void out(ostream &o, const string &v) {
  o << '"';
  for (char c : v) {
    if (c == '"' || c == '\\\\') o << '\\\\' << c;
    else if (c == '\\n') o << "\\\\n";
    else if (c == '\\t') o << "\\\\t";
    else if (c == '\\r') o << "\\\\r";
    else if ((unsigned char)c < 0x20) { char buf[8]; snprintf(buf, sizeof buf, "\\\\u%04x", c); o << buf; }
    else o << c;
  }
  o << '"';
}
void out(ostream &o, const char *v) { out(o, string(v)); }
template <class T> void out(ostream &o, const vector<T> &v) {
  o << '[';
  for (size_t k = 0; k < v.size(); k++) { if (k) o << ','; out(o, (T)v[k]); }
  o << ']';
}
}  // namespace rehearse

int main() {
  string rehearse_in((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
  rehearse::Parser rehearse_parser(rehearse_in);
  rehearse::J rehearse_args = rehearse_parser.parse();
${decls}
  Solution rehearse_solution;
  auto rehearse_result = ${call};
  cout.flush();
  cout << "\\n" << ${JSON.stringify(marker)};
  rehearse::out(cout, rehearse_result);
  cout << "\\n";
  cout.flush();
  return 0;
}
`;
}
