import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import PortfolioSummary from '../components/PortfolioSummary.jsx';
import HoldingRow from '../components/HoldingRow.jsx';
import { useWallet } from '../chain/wallet.js';
import { usePortfolio } from '../data/usePortfolio.js';

export default function Portfolio() {
  const { address, status, connected, onRitual, connect, switchToRitual } = useWallet();
  const { portfolio, pending, error, refresh } = usePortfolio(address);

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <div className="max-w-2xl">
        <div className="kicker">Portfolio</div>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-cream">
          Your holdings under guardianship
        </h1>
        <p className="mt-4 leading-relaxed text-fog">
          Every position below is read live from Ritual Chain — balances from each token contract,
          prices from its LaunchPool, covenant state from its guardian. No cached numbers, no wishful ones.
        </p>
      </div>

      {/* Reads go through the RPC, not the wallet — a wrong network only blocks trades. */}
      {connected && !onRitual && (
        <p className="mt-8 text-sm text-status-warn">
          Your wallet is on another network. Holdings still read fine, but trading needs Ritual Chain —{' '}
          <button
            type="button"
            onClick={switchToRitual}
            className="underline decoration-status-warn/40 underline-offset-4 hover:text-cream"
          >
            switch network
          </button>
          .
        </p>
      )}

      {!connected ? (
        <Card className="mt-8 p-12 text-center text-fog">
          <p>Connect a wallet to see which covenant-enforced tokens it holds.</p>
          <button
            type="button"
            onClick={connect}
            disabled={status === 'connecting'}
            className="btn-ember mt-6 text-xs disabled:opacity-60"
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </Card>
      ) : pending ? (
        <Card className="mt-8 p-12 text-center text-fog">Reading your holdings from Ritual Chain testnet…</Card>
      ) : error ? (
        <Card className="mt-8 p-12 text-center text-status-warn">
          <p>{error}</p>
          <button type="button" onClick={refresh} className="btn-ghost mt-6 text-xs">
            Retry
          </button>
        </Card>
      ) : portfolio && portfolio.holdings.length === 0 ? (
        <Card className="mt-8 p-12 text-center text-fog">
          This wallet holds no Vestal launches yet.{' '}
          <Link to="/explore" className="text-ember underline decoration-ember/30 underline-offset-4 hover:text-gold">
            Explore launches
          </Link>
        </Card>
      ) : portfolio ? (
        <>
          <div className="mt-8">
            <PortfolioSummary
              nativeBalance={portfolio.nativeBalance}
              totalValueNative={portfolio.totalValueNative}
              holdingsCount={portfolio.holdings.length}
              address={address}
            />
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Holdings</h2>
            <button type="button" onClick={refresh} className="btn-ghost !px-4 !py-2 text-xs">
              Refresh
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {portfolio.holdings.map((holding) => (
              <HoldingRow key={holding.launch.id} holding={holding} />
            ))}
          </div>

          <p className="mt-10 text-xs text-faint">
            Balances and prices are live reads from Ritual Chain testnet — each token is priced from the
            reserves of its own LaunchPool and valued in tRITUAL. Tokens without a seeded pool show no market.
          </p>
        </>
      ) : null}
    </div>
  );
}
