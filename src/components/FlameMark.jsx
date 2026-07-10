/** The Vestal guardian flame mark. */
export default function FlameMark({ size = 28, ring = false, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {ring && (
        <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      )}
      <path
        d="M16 3c3 5-4 7-1 12 1.6 2.7 5 2.4 6-1 4 6-1 15-5 15S7 24 9 17c1.5-5.2 6-7 7-14z"
        fill="url(#flame-grad)"
      />
      <defs>
        <linearGradient id="flame-grad" x1="16" y1="3" x2="16" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB347" />
          <stop offset="1" stopColor="#F2601F" />
        </linearGradient>
      </defs>
    </svg>
  );
}
