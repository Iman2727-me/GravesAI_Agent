type Point = { tDays: number; riskIndex: number };

export default function TwinChart({ trajectory }: { trajectory: Point[] }) {
  const width = 640;
  const height = 180;
  const pad = 16;
  if (!trajectory.length) return null;

  const maxT = Math.max(...trajectory.map((p) => p.tDays), 1);
  const xs = trajectory.map((p) => pad + (p.tDays / maxT) * (width - pad * 2));
  const ys = trajectory.map(
    (p) => height - pad - p.riskIndex * (height - pad * 2),
  );
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${d} L${xs[xs.length - 1]},${height - pad} L${xs[0]},${height - pad} Z`;

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <title>Digital twin risk trajectory</title>
      <defs>
        <linearGradient id="twinFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1aa6b2" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#1aa6b2" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#twinFill)" />
      <path
        d={d}
        fill="none"
        stroke="#065a63"
        strokeWidth="2.5"
        strokeLinejoin="round"
        style={{ animation: "draw 1.1s ease both" }}
      />
    </svg>
  );
}
