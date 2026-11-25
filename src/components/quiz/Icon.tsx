// Small inline SVG icons: no icon library, no emoji (emoji look different on every device).
//
// Decorative by default (aria-hidden): screen readers skip them. So ALWAYS put text next to an icon
// (visible, or sr-only), e.g. a tick AND the word "Correct". Meaning must never rely on the icon's
// shape or colour alone.

/** Drawing instructions for each icon, on a 24×24 grid. `as const` = exactly these names. */
const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cross: 'M7 7l10 10M17 7L7 17',
  arrowLeft: 'M15 6l-6 6 6 6',
  arrowRight: 'M9 6l6 6-6 6',
  info: 'M12 8h.01M11 12h1v5h1',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
} as const;

export type IconName = keyof typeof PATHS; // 'check' | 'cross' | … (only these six)

/**
 * <Icon name="check" />                          16px, takes the surrounding text colour
 * <Icon name="info" className="size-5 text-quiz-muted" />
 */
export function Icon({ name, className = 'size-4' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor" // = the text colour around it
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false" // old Edge/IE would otherwise make the SVG a Tab stop
      className={`shrink-0 ${className}`}
    >
      {name === 'info' && <circle cx="12" cy="12" r="9" />}
      <path d={PATHS[name]} />
    </svg>
  );
}
