// The way around the site. On a tablet and desktop: a header with the logo, Walkthrough, Support, the game choice and the
// two main places. On a phone: a slim header with the logo and a hamburger that opens a menu (the other pages, and the game
// choice), and the tab bar along the bottom.
import { useEffect, useState } from 'react';
import { Logo, TabBar } from '../components';
import type { TabItem } from '../components';
import { copy } from '../copy/en';
import { cx } from '../cx';
import { Link, usePath } from '../router';
import { useLayout } from './useLayout';
import styles from './SiteNav.module.css';

const t = copy.siteNav;

const TABS: readonly TabItem[] = [
  { id: 'lists', label: copy.tabs.lists, to: '/lists' },
  { id: 'plan', label: copy.tabs.plan, to: '/plan' },
  { id: 'dive', label: copy.tabs.dive, to: '/dive' },
  { id: 'more', label: copy.tabs.more, to: '/more' },
];

// Which tab a page belongs to.
export function tabFor(path: string): string {
  if (path.startsWith('/lists') || path === '/import') return 'lists';
  if (path === '/plan' || path === '/groups') return 'plan';
  if (path === '/dive' || path === '/trip') return 'dive';
  if (['/more', '/walkthrough', '/support', '/about', '/privacy'].includes(path)) return 'more';
  return '';
}

function GameSelect() {
  return (
    <label className={styles.game}>
      <span className={styles.srOnly}>{t.game}</span>
      <select className={styles.select} defaultValue="magic">
        <option value="magic">{copy.games.magic}</option>
        <option value="pokemon" disabled>{t.gameComing(copy.games.pokemon)}</option>
        <option value="lorcana" disabled>{t.gameComing(copy.games.lorcana)}</option>
        <option value="yugioh" disabled>{t.gameComing(copy.games.yugioh)}</option>
      </select>
    </label>
  );
}

// Three bars that become a cross while the menu is open.
function Hamburger({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" className={styles.burger} viewBox="0 0 24 24">
      {open
        ? <path d="M6 6l12 12M18 6L6 18" />
        : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

export function SiteNav() {
  const phone = useLayout() === 'phone';
  const path = usePath();
  // The menu is open for the page it was opened on, so going anywhere closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const current = (to: string) => (path === to || (to === '/lists' && path.startsWith('/lists')) ? 'page' : undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenAt(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (phone) {
    return (
      <>
        <div className={styles.phoneTop}>
          <header className={styles.phoneHeader}>
            <Link to="/" className={styles.brand} aria-label={t.home}><Logo size="sm" /><span className={styles.name}>{copy.app.name}</span></Link>
            <button type="button" className={styles.menu} aria-expanded={open} aria-controls="phone-menu" aria-label={open ? t.menuClose : t.menuLabel} onClick={() => setOpenAt(open ? null : path)}>
              <Hamburger open={open} />
            </button>
          </header>
          {open && (
            <nav id="phone-menu" aria-label={t.menuNav} className={styles.phoneMenu}>
              <ul className={styles.phoneMenuList}>
                <li><Link to="/walkthrough" className={styles.phoneMenuLink}>{copy.more.walkthrough}</Link></li>
                <li><Link to="/support" className={styles.phoneMenuLink}>{copy.more.support}</Link></li>
                <li><Link to="/about" className={styles.phoneMenuLink}>{copy.more.about}</Link></li>
                <li><Link to="/privacy" className={styles.phoneMenuLink}>{copy.more.privacy}</Link></li>
              </ul>
              <GameSelect />
            </nav>
          )}
        </div>
        <div className={styles.tabs}><TabBar items={TABS} current={tabFor(path)} /></div>
      </>
    );
  }

  return (
    <header className={styles.header}>
      <nav aria-label={t.label} className={styles.bar}>
        <Link to="/" className={styles.brand} aria-label={t.home}><Logo size="sm" /><span className={styles.name}>{copy.app.name}</span></Link>
        <span className={styles.rule} aria-hidden="true" />
        <GameSelect />
        <div className={styles.links}>
          <Link to="/walkthrough" className={styles.link} aria-current={current('/walkthrough')}>{t.walkthrough}</Link>
          <Link to="/lists" className={styles.link} aria-current={current('/lists')}>{t.lists}</Link>
          <Link to="/support" className={styles.link} aria-current={current('/support')}>{t.support}</Link>
          <Link to="/dive" className={cx(styles.link, styles.primary)} aria-current={current('/dive')}>{t.dive}</Link>
        </div>
      </nav>
    </header>
  );
}
