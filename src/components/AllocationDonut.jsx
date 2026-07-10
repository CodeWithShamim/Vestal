/**
 * Tokenomics composition donut. Color encodes order in a warm sequential
 * ramp (monotonic lightness), never identity — identity always comes from
 * the adjacent legend and the direct % labels, so the chart survives CVD
 * and grayscale. 2px surface gaps between segments.
 */
const RAMP = ['#FFC46B', '#F2711F', '#C24632', '#8C3B1E'];

export default function AllocationDonut({ allocations, size = 200 }) {
  const total = allocations.reduce((s, a) => s + a.pct, 0) || 1;
  const r = 74;
  const cx = 100;
  const cy = 100;
  const stroke = 30;
  const C = 2 * Math.PI * r;
  const gapDeg = 2.4; // ≈2px surface gap at this radius

  let angle = -90;
  const segments = allocations
    .filter((a) => a.pct > 0)
    .map((a, i) => {
      const sweep = (a.pct / total) * 360;
      const seg = { ...a, color: RAMP[i % RAMP.length], start: angle, sweep };
      angle += sweep;
      return seg;
    });

  const polar = (deg, radius) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Allocation: ${segments.map((s) => `${s.label} ${Math.round((s.pct / total) * 100)}%`).join(', ')}`}
      >
        {segments.map((s) => {
          const sweep = Math.max(0.5, s.sweep - gapDeg);
          const dash = (sweep / 360) * C;
          const offset = (-(s.start + gapDeg / 2 + 90) / 360) * C;
          return (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
            />
          );
        })}
        {/* direct % labels on segments large enough to hold one */}
        {segments
          .filter((s) => (s.pct / total) * 100 >= 8)
          .map((s) => {
            const [lx, ly] = polar(s.start + s.sweep / 2, r);
            return (
              <text
                key={`label-${s.label}`}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#0A0A0C"
                fontSize="11"
                fontWeight="700"
              >
                {Math.round((s.pct / total) * 100)}%
              </text>
            );
          })}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#9A948A" fontSize="10" letterSpacing="2">
          TOTAL
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#F2EDE3" fontSize="17" fontWeight="600" fontFamily="Fraunces, serif">
          100%
        </text>
      </svg>
      <ul className="flex flex-col gap-2.5" aria-hidden="true">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="text-fog">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold text-cream">{Math.round((s.pct / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
