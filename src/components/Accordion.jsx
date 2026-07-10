import { useState } from 'react';

/** Smooth single-open accordion (CSS grid-rows height animation). */
export default function Accordion({ items }) {
  const [open, setOpen] = useState(-1);
  return (
    <div className="divide-y divide-linefaint rounded-xl border border-line bg-surface">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-raise/60"
            >
              <span className="font-medium text-cream">{item.q}</span>
              <span
                className={`shrink-0 text-fog transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                aria-hidden="true"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-fog">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
