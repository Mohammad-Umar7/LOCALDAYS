import { Link } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import { CATEGORIES } from '@/data/categories';
import { Logo } from '../brand/Logo';

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-oasis-950 pb-28 pt-20 text-paper md:pb-12">
      <div className="pattern-girih-light absolute inset-0 opacity-40" />
      <div className="shell relative">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-5">
              <Logo dark className="h-16 md:h-[72px]" />
              <span className="font-arabic text-2xl text-paper/50">{BRAND.nameArabic}</span>
            </div>
            <p className="mt-6 max-w-sm font-display text-[28px] leading-[1.1] tracking-tight text-paper">
              {BRAND.taglineLead} <span className="serif-italic text-honey-300">{BRAND.taglineEmphasis}</span>
            </p>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-paper/60">
              Experience-driven local commerce for {BRAND.city}: book real traditions, then keep buying from the people who shared them.
            </p>
          </div>
          <FooterCol title="Experiences" links={CATEGORIES.map((c) => ({ to: `/c/${c.id}`, label: c.name }))} />
          <FooterCol
            title="LocalDays"
            links={[
              { to: '/how-it-works', label: 'How it works' },
              { to: '/compose', label: 'Day Composer' },
              { to: '/passport', label: 'LocalDays Passport' },
              { to: '/me', label: 'My LocalDays' },
              { to: '/impact', label: 'Business & impact' },
            ]}
          />
          <FooterCol
            title="For hosts"
            links={[
              { to: '/hosts', label: 'Become a host' },
              { to: '/hosts#pricing', label: 'Pricing & commission' },
              { to: '/host', label: 'Host dashboard (demo)' },
              { to: '/host/intelligence', label: 'Harvest & Demand Intelligence' },
            ]}
          />
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-paper/10 pt-8 text-[12.5px] text-paper/45 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl">{BRAND.demoNotice} Photography via Unsplash (free licence), shown for illustration only. 3D venues are illustrative previews, not verified representations of real properties.</p>
          <p className="shrink-0">© {new Date().getFullYear()} {BRAND.name} · Sharjah, UAE</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <div className="eyebrow text-paper/40">{title}</div>
      <ul className="mt-5 space-y-3">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="link-underline text-[14px] text-paper/80 hover:text-paper">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
