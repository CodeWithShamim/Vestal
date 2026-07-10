/** Generated-initials token avatar. Deterministic warm tone per symbol. */
export default function TokenAvatar({ name, symbol, size = 44, className = '' }) {
  const initials = (symbol || name || '?').slice(0, 3).toUpperCase();
  // Deterministic warm hue in the brand band (18°–45°), varied by symbol.
  let h = 0;
  for (let i = 0; i < initials.length; i++) h = (h * 31 + initials.charCodeAt(i)) % 997;
  const hue = 18 + (h % 28);
  const light = 30 + (h % 14);
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-cream ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.3,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue} 70% ${light + 12}%), hsl(${hue} 65% ${Math.max(12, light - 10)}%))`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -6px 12px rgba(0,0,0,0.35)',
      }}
    >
      {initials}
    </div>
  );
}
