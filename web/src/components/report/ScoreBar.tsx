export function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div
      role="meter"
      aria-label={`${label} score`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      className="h-1.5 rounded-[3px] bg-line"
    >
      <div className="h-1.5 rounded-[3px] bg-accent" style={{ width: `${score}%` }} />
    </div>
  );
}
