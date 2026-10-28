export default function echoGroups(words: string[]): number {
  const keys = new Set<string>();
  for (const w of words) {
    let smallest = w;
    for (let i = 1; i < w.length; i++) {
      const r = w.slice(i) + w.slice(0, i);
      if (r < smallest) smallest = r;
    }
    keys.add(smallest);
  }
  return keys.size;
}
