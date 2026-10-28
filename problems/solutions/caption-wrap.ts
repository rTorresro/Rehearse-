export default function wrapCaption(text: string, width: number): string[] {
  const pieces: string[] = [];
  for (const word of text.split(" ").filter(Boolean)) {
    for (let i = 0; i < word.length; i += width) pieces.push(word.slice(i, i + width));
  }
  const lines: string[] = [];
  let line = "";
  for (const piece of pieces) {
    if (line === "") line = piece;
    else if (line.length + 1 + piece.length <= width) line += " " + piece;
    else {
      lines.push(line);
      line = piece;
    }
  }
  if (line) lines.push(line);
  return lines;
}
