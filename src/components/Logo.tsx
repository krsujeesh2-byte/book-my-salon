import clsx from 'clsx';

/**
 * Inline SVG recreation of the Book My Salon wordmark (ticket-notch "my" badge
 * + "book"/"salon" text), built from the supplied brand kit so the app never
 * depends on an external image asset shipping correctly.
 *
 * Drop the real exported files (primary logo, alternate logo, app icon,
 * favicon) into /public/brand/ and swap the <img> variant in if you want the
 * exact production artwork instead of this SVG approximation.
 */
export function Logo({
  variant = 'dark',
  withTagline = false,
  className,
}: {
  variant?: 'dark' | 'light';
  withTagline?: boolean;
  className?: string;
}) {
  const textColor = variant === 'dark' ? '#0A0A0A' : '#FFFFFF';
  return (
    <div className={clsx('inline-flex flex-col', className)}>
      <div className="inline-flex items-center gap-2">
        <span className="text-xl font-semibold tracking-tight" style={{ color: textColor }}>
          book
        </span>
        <TicketBadge />
        <span className="text-xl font-semibold tracking-tight" style={{ color: textColor }}>
          salon
        </span>
      </div>
      {withTagline && (
        <span
          className="mt-1 text-center text-[10px] font-medium uppercase tracking-[0.25em]"
          style={{ color: variant === 'dark' ? '#5B615C' : '#C9D6C4' }}
        >
          Beauty · Confidence · Booked
        </span>
      )}
    </div>
  );
}

function TicketBadge() {
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M4 2h26a4 4 0 0 1 4 4v3a3 3 0 0 0 0 6v3a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4v-3a3 3 0 0 0 0-6V6a4 4 0 0 1 4-4Z"
        fill="#6BC24A"
      />
      <text x="17" y="17.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF" fontFamily="Poppins, sans-serif">
        my
      </text>
    </svg>
  );
}

export function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl bg-brand-black"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.6} height={size * 0.46} viewBox="0 0 34 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          d="M4 2h26a4 4 0 0 1 4 4v3a3 3 0 0 0 0 6v3a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4v-3a3 3 0 0 0 0-6V6a4 4 0 0 1 4-4Z"
          fill="#6BC24A"
        />
        <text x="17" y="17.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF" fontFamily="Poppins, sans-serif">
          my
        </text>
      </svg>
    </div>
  );
}
