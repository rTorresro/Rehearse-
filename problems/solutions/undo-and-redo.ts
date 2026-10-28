type Change = { kind: "type" | "delete"; chars: string };

export default function finalText(commands: string[]): string {
  let text = "";
  const undo: Change[] = [];
  const redo: Change[] = [];
  const apply = (c: Change) => {
    text = c.kind === "type" ? text + c.chars : text.slice(0, text.length - c.chars.length);
  };
  const revert = (c: Change) => {
    text = c.kind === "type" ? text.slice(0, text.length - c.chars.length) : text + c.chars;
  };
  for (const cmd of commands) {
    const [op, arg = ""] = cmd.split(" ");
    if (op === "type" || op === "delete") {
      // store what actually changed, so undoing an oversized delete restores the right text
      const chars = op === "type" ? arg : text.slice(Math.max(0, text.length - Number(arg)));
      const change: Change = { kind: op, chars };
      apply(change);
      undo.push(change);
      redo.length = 0;
    } else if (op === "undo") {
      const c = undo.pop();
      if (c) {
        revert(c);
        redo.push(c);
      }
    } else if (op === "redo") {
      const c = redo.pop();
      if (c) {
        apply(c);
        undo.push(c);
      }
    }
  }
  return text;
}
