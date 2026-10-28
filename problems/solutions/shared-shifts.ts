export default function sharedIds(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i]! < b[j]!) i++;
    else if (a[i]! > b[j]!) j++;
    else {
      if (out.at(-1) !== a[i]) out.push(a[i]!);
      i++;
      j++;
    }
  }
  return out;
}
