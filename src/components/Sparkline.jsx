import { useRef, useState } from 'react';

/**
 * Single-series price chart: 2px ember line, soft area fill, crosshair +
 * tooltip on hover. One series, so no legend — the caption names it.
 * Callers must pass at least two points; formatValue supplies the unit.
 */
export default function Sparkline({ series, height = 180, formatValue = (v) => v.toFixed(4) }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const w = 600;
  const h = height;
  const pad = 8;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const x = (i) => pad + (i / (series.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - min) / span) * (h - pad * 2.5);

  const linePath = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(series.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;

  function onMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((px - pad) / (w - pad * 2)) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  }

  const last = series.length - 1;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="block w-full cursor-crosshair"
        role="img"
        aria-label={`Price history, latest ${formatValue(series[last])}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-ember)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-ember)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* recessive gridlines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={pad} x2={w - pad} y1={h * t} y2={h * t} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="2 6" />
        ))}
        <path d={areaPath} fill="url(#spark-fill)" />
        <path d={linePath} fill="none" stroke="var(--color-ember)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* latest-value marker */}
        <circle cx={x(last)} cy={y(series[last])} r="4" fill="var(--color-gold)" stroke="var(--color-surface)" strokeWidth="2" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad} y2={h - pad} stroke="var(--color-fog)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(series[hover])} r="4.5" fill="var(--color-ember)" stroke="var(--color-surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-md border border-line bg-raise px-2.5 py-1.5 mono text-cream shadow-lg"
          style={{
            left: `${(x(hover) / w) * 100}%`,
            transform: `translateX(${hover > series.length * 0.7 ? '-110%' : '10%'})`,
          }}
        >
          {formatValue(series[hover])}
        </div>
      )}
    </div>
  );
}
