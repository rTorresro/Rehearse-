// drawn in a 140 unit box and scaled to 168px, same geometry as the report mock
const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({ score }: { score: number }) {
  const filled = (CIRCUMFERENCE * score) / 100;

  return (
    <svg
      width="168"
      height="168"
      viewBox="0 0 140 140"
      role="img"
      aria-label={`Overall score ${score} out of 100`}
    >
      <circle cx="70" cy="70" r={RADIUS} fill="none" strokeWidth="10" className="stroke-line" />
      <circle
        cx="70"
        cy="70"
        r={RADIUS}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        transform="rotate(-90 70 70)"
        className="stroke-accent"
      />
      <text
        x="70"
        y="76"
        textAnchor="middle"
        fontSize="42"
        fontWeight="500"
        className="fill-fg font-mono"
      >
        {score}
      </text>
      <text x="70" y="96" textAnchor="middle" fontSize="11" className="fill-muted font-sans">
        out of 100
      </text>
    </svg>
  );
}
