/**
 * Guardian trust score meter. Value always shown as text; the bar is a
 * single ember mark on a recessive track.
 */
export default function TrustMeter({ score, compact = false }) {
  return (
    <div className={compact ? 'w-full' : 'w-full max-w-xs'}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Trust score</span>
        <span className={`font-semibold text-cream ${compact ? 'text-sm' : 'text-base'}`}>{score}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raise"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label="Guardian trust score derived from enforcement history"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            background: 'linear-gradient(90deg, #B8410F, #F2601F 70%, #FFB347)',
          }}
        />
      </div>
    </div>
  );
}
