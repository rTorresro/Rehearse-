export default function compressRuns(s: string): string {
  const parts: string[] = [];
  for (let start = 0; start < s.length;) {
    let end = start;
    while (end < s.length && s[end] === s[start]) end++;
    const len = end - start;
    parts.push(len === 1 ? s[start]! : `${s[start]}${len}`);
    start = end;
  }
  return parts.join("");
}
