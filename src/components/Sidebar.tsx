'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Logo } from './Logo';

const NAV_SECTIONS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: '',
    items: [{ href: '/', label: 'Dashboard' }],
  },
  {
    label: 'Bookings',
    items: [{ href: '/appointments', label: 'Appointments' }],
  },
  {
    label: '',
    items: [
      { href: '/customers', label: 'Customers' },
      { href: '/team', label: 'Team' },
      { href: '/services', label: 'Services' },
    ],
  },
  {
    label: 'Billing',
    items: [{ href: '/billing', label: 'Invoices & Payments' }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-surface-border bg-white">
      <div className="px-5 py-6">
        <Logo variant="dark" />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'block rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-brand-green-light text-brand-black' : 'text-ink-muted hover:bg-surface-subtle'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
