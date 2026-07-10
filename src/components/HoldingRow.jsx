import { Link } from 'react-router-dom';
import Card from './Card.jsx';
import Badge from './Badge.jsx';
import TokenAvatar from './TokenAvatar.jsx';
import { fmtNative } from '../data/launches.js';
import { RITUAL_TESTNET } from '../config/ritual.js';

const SYM = RITUAL_TESTNET.nativeCurrency.symbol;

/** One holding in the portfolio list; the whole row links to the token page. */
export default function HoldingRow({ holding }) {
  const { launch, balance, priceNative, valueNative, change } = holding;
  const priced = priceNative != null;

  return (
    <Link to={`/token/${launch.id}`} className="block focus-visible:outline-2 focus-visible:outline-ember">
      <Card lift className="p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-1 basis-52 items-center gap-3">
            <TokenAvatar name={launch.name} symbol={launch.symbol} />
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-medium leading-tight text-cream">{launch.name}</h3>
              <span className="mono text-faint">${launch.symbol}</span>
            </div>
            <Badge status={launch.guardian.status} className="ml-auto sm:ml-1" />
          </div>

          <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3 border-t border-linefaint pt-4 text-sm sm:w-auto sm:grid-cols-[repeat(4,minmax(5.5rem,auto))] sm:border-0 sm:pt-0 sm:text-right">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Balance</div>
              <div className="mono mt-0.5 text-cream">
                {balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Price</div>
              {priced ? (
                <div className="mt-0.5 font-semibold text-cream">
                  {fmtNative(priceNative)} <span className="font-normal text-faint">{SYM}</span>
                </div>
              ) : (
                <div className="mt-0.5 text-faint">no market yet</div>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Value</div>
              {priced && valueNative != null ? (
                <div className="mt-0.5 font-semibold text-cream">
                  {fmtNative(valueNative)} <span className="font-normal text-faint">{SYM}</span>
                </div>
              ) : (
                <div className="mt-0.5 text-faint">—</div>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Change</div>
              {change ? (
                <div className={`mt-0.5 font-semibold ${change.pct >= 0 ? 'text-status-good' : 'text-status-warn'}`}>
                  {change.pct >= 0 ? '▲' : '▼'} {Math.abs(change.pct).toFixed(1)}%
                  <span className="font-normal text-faint"> · {change.label}</span>
                </div>
              ) : (
                <div className="mt-0.5 text-faint">—</div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
