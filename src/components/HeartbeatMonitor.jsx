import { fmtBlock, blocksToApproxTime } from '../data/launches.js';

/**
 * The guardian's vital signs: an ECG trace driven by CSS dash animation,
 * last heartbeat block, and the consensus revival count.
 */
export default function HeartbeatMonitor({ guardian, currentBlock }) {
  const blocksSince = currentBlock - guardian.lastHeartbeatBlock;
  const late = guardian.status === 'reviving';
  const traceColor = late ? '#98ABC4' : '#F2601F';

  return (
    <div className="rounded-lg border border-linefaint bg-ink/60 p-4">
      <div className="flex items-center justify-between">
        <span className="kicker">Heartbeat</span>
        <span className={`text-xs font-medium ${late ? 'text-status-info' : 'text-status-good'}`}>
          {late ? 'Signal lost — consensus reviving' : 'Signal healthy'}
        </span>
      </div>
      <svg viewBox="0 0 480 64" className="mt-3 block w-full" aria-hidden="true">
        <path
          d="M0 36 H120 l10 -6 10 6 14 0 8 -26 10 44 8 -18 h140 l10 -6 10 6 14 0 8 -26 10 44 8 -18 H480"
          fill="none"
          stroke={traceColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="480"
          className="animate-ecg"
          opacity={late ? 0.45 : 1}
        />
        <path
          d="M0 36 H120 l10 -6 10 6 14 0 8 -26 10 44 8 -18 h140 l10 -6 10 6 14 0 8 -26 10 44 8 -18 H480"
          fill="none"
          stroke={traceColor}
          strokeWidth="2"
          opacity="0.12"
        />
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-faint">Last heartbeat</div>
          <div className="mono mt-0.5 text-cream">
            block {fmtBlock(guardian.lastHeartbeatBlock)}
            <span className="text-faint"> · {blocksToApproxTime(blocksSince)} ago</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-faint">Consensus revivals</div>
          <div className="mono mt-0.5 text-cream">
            {guardian.revivals}
            {guardian.revivals > 0 && <span className="text-faint"> · state never lost</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
