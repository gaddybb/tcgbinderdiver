// The way around the site. On a tablet and desktop: a header with the logo, Walkthrough, Support, the game choice and the
// two main places. On a phone: a slim header with the logo and a Menu link, and the tab bar along the bottom.
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

export function SiteNav() {
  const phone = useLayout() === 'phone';
  const path = usePath();
  const current = (to: string) => (path === to || (to === '/lists' && path.startsWith('/lists')) ? 'page' : undefined);

  if (phone) {
    return (
      <>
        <header className={styles.phoneHeader}>
          <Link to="/" className={styles.brand} aria-label={t.home}><Logo size="sm" /><span className={styles.name}>{copy.app.name}</span></Link>
          <Link to="/more" className={styles.menu} aria-label={t.menuLabel}>{t.menu}</Link>
        </header>
        <div className={styles.tabs}><TabBar items={TABS} current={tabFor(path)} /></div>
      </>
    );
  }

  return (
    <header className={styles.header}>
      <nav aria-label={t.label} className={styles.bar}>
        <Link to="/" className={styles.brand} aria-label={t.home}><Logo size="sm" /><span className={styles.name}>{copy.app.name}</span></Link>
        <span className={styles.rule} aria-hidden="true" />
        <label className={styles.game}>
          <span className={styles.srOnly}>{t.game}</span>
          <select className={styles.select} defaultValue="magic">
            <option value="magic">{copy.games.magic}</option>
            <option value="pokemon" disabled>{t.gameComing(copy.games.pokemon)}</option>
            <option value="lorcana" disabled>{t.gameComing(copy.games.lorcana)}</option>
            <option value="yugioh" disabled>{t.gameComing(copy.games.yugioh)}</option>
          </select>
        </label>
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
