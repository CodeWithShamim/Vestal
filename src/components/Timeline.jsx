import { fmtBlock, shortHash, blocksToApproxTime } from '../data/launches.js';

const TYPE_META = {
  wake: { label: 'Scheduled wake', tone: 'text-fog border-line' },
  check_ok: { label: 'Audit passed', tone: 'text-status-good border-status-good/40' },
  checkpoint: { label: 'Checkpoint', tone: 'text-fog border-line' },
  release: { label: 'Vesting release', tone: 'text-gold border-gold/40' },
  flag: { label: 'Flagged', tone: 'text-status-warn border-status-warn/40' },
  freeze: { label: 'Freeze executed', tone: 'text-status-warn border-status-warn/60' },
  revival: { label: 'Consensus revival', tone: 'text-status-info border-status-info/40' },
};

const ICONS = {
  wake: 'M8 4v4l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z',
  check_ok: 'M8 1.5 13.5 4v4c0 3.2-2.3 5.6-5.5 6.5C4.8 13.6 2.5 11.2 2.5 8V4L8 1.5zM5.8 8l1.6 1.6L10.5 6.4',
  checkpoint: 'M3 3h8l2 2v8H3V3zM5.5 3v3h4V3M5.5 13V9h5v4',
  release: 'M8 10.5V3M8 3 5 6M8 3l3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2',
  flag: 'M4 14V2.5M4 3h8l-1.8 2.5L12 8H4',
  freeze: 'M8 1.5v13M8 8l4.5-2.6M8 8 3.5 5.4M8 8l4.5 2.6M8 8l-4.5 2.6M5.5 2.8 8 4.2l2.5-1.4M5.5 13.2 8 11.8l2.5 1.4',
  revival: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6',
};

function EventIcon({ type }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={ICONS[type] ?? ICONS.wake} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Enforcement log timeline — every entry carries its TEE attestation hash. */
export default function Timeline({ events, currentBlock }) {
  if (events.length === 0) {
    return <p className="text-sm text-faint">No enforcement actions recorded in the recent block window.</p>;
  }
  return (
    <ol className="relative">
      {events.map((e, i) => {
        const meta = TYPE_META[e.type] ?? TYPE_META.wake;
        return (
          <li key={`${e.block}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
            {i < events.length - 1 && (
              <span aria-hidden="true" className="absolute left-[15px] top-8 h-full w-px bg-linefaint" />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-surface ${meta.tone}`}
            >
              <EventIcon type={e.type} />
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className={`text-xs font-semibold uppercase tracking-wider ${meta.tone.split(' ')[0]}`}>
                  {meta.label}
                </span>
                <span className="mono text-faint">
                  block {fmtBlock(e.block)} · {blocksToApproxTime(currentBlock - e.block)} ago
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-fog">{e.detail}</p>
              <span
                title={e.attestation}
                className="mono mt-1 inline-flex items-center gap-1.5 text-ember/90"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1.2 10.5 3v3c0 2.4-1.8 4.2-4.5 4.8C3.3 10.2 1.5 8.4 1.5 6V3L6 1.2z" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                TEE attestation {shortHash(e.attestation)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
