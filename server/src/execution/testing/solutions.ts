import type { Language } from "@rehearse/shared";

// correct answers in every language, for problems that between them use every value type:
// int, int[], int[][], string, string[], bool, and tree
export const SOLUTIONS: Record<string, Record<Language, string>> = {
  "calm-streak": {
    python: `def calm_streak(readings: list[int], k: int) -> int:
    if not readings:
        return 0
    best = run = 1
    for i in range(1, len(readings)):
        run = run + 1 if abs(readings[i] - readings[i - 1]) <= k else 1
        best = max(best, run)
    return best
`,
    javascript: `function calmStreak(readings, k) {
  if (!readings.length) return 0;
  let best = 1, run = 1;
  for (let i = 1; i < readings.length; i++) {
    run = Math.abs(readings[i] - readings[i - 1]) <= k ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}
`,
    java: `class Solution {
    public int calmStreak(int[] readings, int k) {
        if (readings.length == 0) return 0;
        int best = 1, run = 1;
        for (int i = 1; i < readings.length; i++) {
            run = Math.abs(readings[i] - readings[i - 1]) <= k ? run + 1 : 1;
            best = Math.max(best, run);
        }
        return best;
    }
}
`,
    cpp: `class Solution {
public:
    int calmStreak(vector<int>& readings, int k) {
        if (readings.empty()) return 0;
        int best = 1, run = 1;
        for (size_t i = 1; i < readings.size(); i++) {
            run = abs(readings[i] - readings[i - 1]) <= k ? run + 1 : 1;
            best = max(best, run);
        }
        return best;
    }
};
`,
  },
  "merge-meeting-slots": {
    python: `def merge_slots(slots):
    merged = []
    for start, end in sorted(slots):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
`,
    javascript: `function mergeSlots(slots) {
  const merged = [];
  for (const [a, b] of [...slots].sort((x, y) => x[0] - y[0])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}
`,
    java: `import java.util.*;

class Solution {
    public int[][] mergeSlots(int[][] slots) {
        Arrays.sort(slots, (a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> merged = new ArrayList<>();
        for (int[] s : slots) {
            if (!merged.isEmpty() && s[0] <= merged.get(merged.size() - 1)[1]) {
                int[] last = merged.get(merged.size() - 1);
                last[1] = Math.max(last[1], s[1]);
            } else {
                merged.add(new int[] {s[0], s[1]});
            }
        }
        return merged.toArray(new int[0][]);
    }
}
`,
    cpp: `class Solution {
public:
    vector<vector<int>> mergeSlots(vector<vector<int>>& slots) {
        sort(slots.begin(), slots.end());
        vector<vector<int>> merged;
        for (auto& s : slots) {
            if (!merged.empty() && s[0] <= merged.back()[1]) merged.back()[1] = max(merged.back()[1], s[1]);
            else merged.push_back(s);
        }
        return merged;
    }
};
`,
  },
  "heaviest-level": {
    python: `def heaviest_level(root):
    if not root:
        return -1
    level, depth, best, best_depth = [root], 0, None, -1
    while level:
        total = sum(n.val for n in level)
        if best is None or total > best:
            best, best_depth = total, depth
        level = [c for n in level for c in (n.left, n.right) if c]
        depth += 1
    return best_depth
`,
    javascript: `function heaviestLevel(root) {
  if (!root) return -1;
  let level = [root], depth = 0, best = -Infinity, bestDepth = -1;
  while (level.length) {
    const total = level.reduce((s, n) => s + n.val, 0);
    if (total > best) { best = total; bestDepth = depth; }
    level = level.flatMap((n) => [n.left, n.right]).filter(Boolean);
    depth++;
  }
  return bestDepth;
}
`,
    java: `import java.util.*;

class Solution {
    public int heaviestLevel(TreeNode root) {
        if (root == null) return -1;
        List<TreeNode> level = new ArrayList<>(List.of(root));
        long best = Long.MIN_VALUE;
        int bestDepth = -1, depth = 0;
        while (!level.isEmpty()) {
            long total = 0;
            List<TreeNode> next = new ArrayList<>();
            for (TreeNode n : level) {
                total += n.val;
                if (n.left != null) next.add(n.left);
                if (n.right != null) next.add(n.right);
            }
            if (total > best) { best = total; bestDepth = depth; }
            level = next;
            depth++;
        }
        return bestDepth;
    }
}
`,
    cpp: `class Solution {
public:
    int heaviestLevel(TreeNode* root) {
        if (!root) return -1;
        vector<TreeNode*> level{root};
        long long best = LLONG_MIN;
        int bestDepth = -1, depth = 0;
        while (!level.empty()) {
            long long total = 0;
            vector<TreeNode*> next;
            for (auto n : level) {
                total += n->val;
                if (n->left) next.push_back(n->left);
                if (n->right) next.push_back(n->right);
            }
            if (total > best) { best = total; bestDepth = depth; }
            level = next;
            depth++;
        }
        return bestDepth;
    }
};
`,
  },
  "shipment-reconciliation": {
    python: `from collections import Counter

def reconcile(shipped, received):
    net = Counter(received)
    net.subtract(Counter(shipped))
    return [f"{sku}:{'+' if d > 0 else '-'}{abs(d)}" for sku, d in sorted(net.items()) if d != 0]
`,
    javascript: `function reconcile(shipped, received) {
  const net = new Map();
  for (const s of received) net.set(s, (net.get(s) || 0) + 1);
  for (const s of shipped) net.set(s, (net.get(s) || 0) - 1);
  return [...net]
    .filter(([, d]) => d !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([s, d]) => \`\${s}:\${d > 0 ? "+" : "-"}\${Math.abs(d)}\`);
}
`,
    // public on purpose: the harness has to cope with it in a single Main.java
    java: `import java.util.*;

public class Solution {
    public String[] reconcile(String[] shipped, String[] received) {
        TreeMap<String, Integer> net = new TreeMap<>();
        for (String s : received) net.merge(s, 1, Integer::sum);
        for (String s : shipped) net.merge(s, -1, Integer::sum);
        List<String> out = new ArrayList<>();
        for (Map.Entry<String, Integer> e : net.entrySet()) {
            int d = e.getValue();
            if (d != 0) out.add(e.getKey() + ":" + (d > 0 ? "+" : "-") + Math.abs(d));
        }
        return out.toArray(new String[0]);
    }
}
`,
    cpp: `class Solution {
public:
    vector<string> reconcile(vector<string>& shipped, vector<string>& received) {
        map<string, int> net;
        for (auto& s : received) net[s]++;
        for (auto& s : shipped) net[s]--;
        vector<string> out;
        for (auto& [sku, d] : net)
            if (d) out.push_back(sku + ":" + (d > 0 ? "+" : "-") + to_string(abs(d)));
        return out;
    }
};
`,
  },
  "well-nested-tags": {
    python: `def is_well_nested(tokens):
    stack = []
    for t in tokens:
        if not t.startswith("<") or t.endswith("/>"):
            continue
        if t.startswith("</"):
            if not stack or stack.pop() != t[2:-1]:
                return False
        else:
            stack.append(t[1:-1])
    return not stack
`,
    javascript: `function isWellNested(tokens) {
  const stack = [];
  for (const t of tokens) {
    if (!t.startsWith("<") || t.endsWith("/>")) continue;
    if (t.startsWith("</")) {
      if (stack.pop() !== t.slice(2, -1)) return false;
    } else stack.push(t.slice(1, -1));
  }
  return stack.length === 0;
}
`,
    java: `import java.util.*;

class Solution {
    public boolean isWellNested(String[] tokens) {
        Deque<String> stack = new ArrayDeque<>();
        for (String t : tokens) {
            if (!t.startsWith("<") || t.endsWith("/>")) continue;
            if (t.startsWith("</")) {
                if (stack.isEmpty() || !stack.pop().equals(t.substring(2, t.length() - 1))) return false;
            } else {
                stack.push(t.substring(1, t.length() - 1));
            }
        }
        return stack.isEmpty();
    }
}
`,
    cpp: `class Solution {
public:
    bool isWellNested(vector<string>& tokens) {
        vector<string> stack;
        for (auto& t : tokens) {
            if (t.empty() || t[0] != '<' || (t.size() >= 2 && t.compare(t.size() - 2, 2, "/>") == 0)) continue;
            if (t.size() > 1 && t[1] == '/') {
                if (stack.empty() || stack.back() != t.substr(2, t.size() - 3)) return false;
                stack.pop_back();
            } else {
                stack.push_back(t.substr(1, t.size() - 2));
            }
        }
        return stack.empty();
    }
};
`,
  },
  "run-labels": {
    python: `def compress_runs(s):
    out, i = [], 0
    while i < len(s):
        j = i
        while j < len(s) and s[j] == s[i]:
            j += 1
        out.append(s[i] + (str(j - i) if j - i > 1 else ""))
        i = j
    return "".join(out)
`,
    javascript: `function compressRuns(s) {
  let out = "";
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += s[i] + (j - i > 1 ? j - i : "");
    i = j;
  }
  return out;
}
`,
    java: `class Solution {
    public String compressRuns(String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); ) {
            int j = i;
            while (j < s.length() && s.charAt(j) == s.charAt(i)) j++;
            b.append(s.charAt(i));
            if (j - i > 1) b.append(j - i);
            i = j;
        }
        return b.toString();
    }
}
`,
    cpp: `class Solution {
public:
    string compressRuns(string s) {
        string out;
        for (size_t i = 0; i < s.size();) {
            size_t j = i;
            while (j < s.size() && s[j] == s[i]) j++;
            out += s[i];
            if (j - i > 1) out += to_string(j - i);
            i = j;
        }
        return out;
    }
};
`,
  },
};
