import Card from './Card.jsx';
import StatBlock from './StatBlock.jsx';
import { fmtNative, shortAddr } from '../data/launches.js';
import { RITUAL_TESTNET } from '../config/ritual.js';

const SYM = RITUAL_TESTNET.nativeCurrency.symbol;

const nat = (v) => (
  <>
    {fmtNative(v)} <span className="text-base text-faint">{SYM}</span>
  </>
);

/** Wallet-level stat strip shown at the top of the Portfolio page. */
export default function PortfolioSummary({ nativeBalance, totalValueNative, holdingsCount, address }) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
        <StatBlock label="Holdings value" value={nat(totalValueNative)} accent />
        <StatBlock label="Wallet balance" value={nat(nativeBalance)} />
        <StatBlock label="Tokens held" value={holdingsCount.toLocaleString('en-US')} />
        <StatBlock
          label="Wallet"
          value={<span className="mono !text-2xl">{address ? shortAddr(address) : '—'}</span>}
        />
      </div>
    </Card>
  );
}
