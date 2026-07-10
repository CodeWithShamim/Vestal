const STATUS = {
  active: {
    label: 'Active',
    dot: 'bg-status-good',
    ring: 'bg-status-good',
    text: 'text-status-good',
    border: 'border-status-good/30',
    title: 'Guardian heartbeat healthy — enforcing on schedule',
  },
  enforcing: {
    label: 'Enforcing',
    dot: 'bg-status-warn',
    ring: 'bg-status-warn',
    text: 'text-status-warn',
    border: 'border-status-warn/30',
    title: 'Guardian is actively enforcing against a covenant violation',
  },
  reviving: {
    label: 'Reviving',
    dot: 'bg-status-info',
    ring: 'bg-status-info',
    text: 'text-status-info',
    border: 'border-status-info/30',
    title: 'Missed heartbeat — consensus is restoring the agent from checkpoint',
  },
};

/**
 * Guardian status badge. Status is always conveyed by the label text,
 * never by color alone; the pulsing dot is the heartbeat motif.
 */
export default function Badge({ status, className = '' }) {
  const s = STATUS[status] ?? STATUS.active;
  return (
    <span
      title={s.title}
      className={`inline-flex items-center gap-1.5 rounded-full border ${s.border} bg-raise px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${s.text} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className={`absolute inline-flex h-full w-full rounded-full ${s.ring} animate-pulse-ring`} />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
      </span>
      {s.label}
    </span>
  );
}
