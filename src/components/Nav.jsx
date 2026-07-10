import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import FlameMark from './FlameMark.jsx';

const links = [
  { to: '/explore', label: 'Explore' },
  { to: '/launch', label: 'Launch' },
  { to: '/docs', label: 'Docs' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${isActive ? 'text-cream' : 'text-fog hover:text-cream'}`;

  return (
    <header className="sticky top-0 z-50 border-b border-linefaint bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <FlameMark size={26} />
          <span className="font-display text-lg font-semibold tracking-wide text-cream">Vestal</span>
          <span className="mt-0.5 hidden rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-faint sm:block">
            Testnet
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          <Link to="/launch" className="btn-ember !px-4 !py-2 text-xs">
            Launch a Token
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-fog md:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen(!open)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            {open ? (
              <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-linefaint bg-ink px-5 py-4 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            <Link to="/launch" className="btn-ember w-full text-xs" onClick={() => setOpen(false)}>
              Launch a Token
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
