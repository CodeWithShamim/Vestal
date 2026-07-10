/** Wizard progress: numbered steps with connectors. `current` is 0-indexed. */
export default function StepIndicator({ steps, current }) {
  return (
    <ol className="flex items-center gap-0" aria-label="Launch progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2.5">
              <span
                aria-current={active ? 'step' : undefined}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  active
                    ? 'border-ember bg-ember/15 text-gold'
                    : done
                      ? 'border-ember/50 bg-ember/10 text-ember'
                      : 'border-line bg-surface text-faint'
                }`}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6.5 4.8 9 10 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  active ? 'text-cream' : done ? 'text-fog' : 'text-faint'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                aria-hidden="true"
                className={`mx-3 h-px flex-1 ${done ? 'bg-ember/40' : 'bg-line'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
