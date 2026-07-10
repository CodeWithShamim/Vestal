/** Base surface card. `lift` adds the hover raise used on interactive cards. */
export default function Card({ children, lift = false, className = '', ...rest }) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface ${lift ? 'card-lift' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
