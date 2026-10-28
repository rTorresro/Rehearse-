import type { Language } from "@rehearse/shared";

type Props = {
  value: Language;
  options: { id: Language; label: string }[];
  onChange: (lang: Language) => void;
};

// native select so keyboard and screen readers just work
export function LanguageSelect({ value, options, onChange }: Props) {
  return (
    <select
      aria-label="Language"
      value={value}
      onChange={(e) => onChange(e.target.value as Language)}
      className="rounded-md border border-line-strong bg-surface-3 px-2.5 py-[5px] text-[13px] text-fg"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
