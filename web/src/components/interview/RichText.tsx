import { Fragment } from "react";

// tiny markup for problem text: `code` goes mono, 10^4 becomes a superscript.
// enough for hardcoded problems without pulling in a markdown parser
export function RichText({ text }: { text: string }) {
  return text.split(/(`[^`]+`|\^\d+)/).map((part, i) => {
    if (part.startsWith("`"))
      return (
        <span key={i} className="font-mono text-[13px] text-fg">
          {part.slice(1, -1)}
        </span>
      );
    if (part.startsWith("^")) return <sup key={i}>{part.slice(1)}</sup>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
