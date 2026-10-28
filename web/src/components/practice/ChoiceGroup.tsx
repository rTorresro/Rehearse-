export type Choice<T extends string> = {
  value: T;
  label: string;
  count?: number;
  disabled?: boolean;
};

type Props<T extends string> = {
  legend: string;
  name: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
};

// real radio inputs styled as chips: arrow keys, one tab stop, and screen readers all work for free
export function ChoiceGroup<T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
}: Props<T>) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[13px] font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <label key={c.value} className={c.disabled ? "cursor-not-allowed" : "cursor-pointer"}>
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={value === c.value}
              disabled={c.disabled}
              onChange={() => onChange(c.value)}
              className="peer sr-only"
            />
            <span className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface-3 px-3.5 py-2 text-[13px] text-fg-2 transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-40 hover:text-fg">
              {c.label}
              {c.count !== undefined && (
                <span className="font-mono text-xs text-muted">
                  {c.count}
                  <span className="sr-only"> problems</span>
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
