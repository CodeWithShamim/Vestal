/** Labeled stat tile: kicker label, hero value, optional footnote. */
export default function StatBlock({ label, value, sub, accent = false, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="kicker">{label}</div>
      <div
        className={`font-display text-3xl md:text-4xl font-medium tracking-tight ${
          accent ? 'text-ember-gradient' : 'text-cream'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-faint">{sub}</div>}
    </div>
  );
}
