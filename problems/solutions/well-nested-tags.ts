export default function isWellNested(tokens: string[]): boolean {
  const open: string[] = [];
  for (const t of tokens) {
    if (!t.startsWith("<") || t.endsWith("/>")) continue;
    if (t.startsWith("</")) {
      if (open.pop() !== t.slice(2, -1)) return false;
    } else open.push(t.slice(1, -1));
  }
  return open.length === 0;
}
