import { Link } from 'react-router-dom';
import FlameMark from './FlameMark.jsx';

const external = [
  { label: 'GitHub', href: '#github' },
  { label: 'X / Twitter', href: '#x' },
  { label: 'Discord', href: '#discord' },
];

export default function Footer() {
  return (
    <footer className="border-t border-linefaint bg-ink">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <FlameMark size={24} />
              <span className="font-display text-lg font-semibold text-cream">Vestal</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-fog">
              The launchpad where launch terms are physics, not promises — every covenant enforced by a
              sovereign agent that answers to no one, including us.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fog">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full rounded-full bg-ember animate-pulse-ring" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-ember" />
              </span>
              Built on Ritual Chain testnet
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <div className="kicker">Protocol</div>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                <li><Link className="text-fog transition-colors hover:text-cream" to="/explore">Explore launches</Link></li>
                <li><Link className="text-fog transition-colors hover:text-cream" to="/launch">Launch a token</Link></li>
                <li><Link className="text-fog transition-colors hover:text-cream" to="/docs">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <div className="kicker">Community</div>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                {external.map((l) => (
                  <li key={l.label}>
                    <a
                      className="text-fog transition-colors hover:text-cream"
                      href={l.href}
                      title="Community links go live with the public beta"
                      onClick={(e) => e.preventDefault()}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="kicker">Ritual</div>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                <li><Link className="text-fog transition-colors hover:text-cream" to="/docs#architecture">Architecture</Link></li>
                <li><Link className="text-fog transition-colors hover:text-cream" to="/docs#lifecycle">Guardian lifecycle</Link></li>
                <li><Link className="text-fog transition-colors hover:text-cream" to="/docs#roadmap">Roadmap</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-linefaint pt-6 text-xs text-faint md:flex-row md:justify-between">
          <span>© 2026 Vestal. Testnet software — nothing here is financial advice.</span>
          <span>All statistics shown are illustrative testnet data.</span>
        </div>
      </div>
    </footer>
  );
}
