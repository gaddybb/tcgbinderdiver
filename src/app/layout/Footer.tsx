import { copy } from '../copy/en';
import { KOFI_URL } from '../links';
import { Link } from '../router';
import styles from './Footer.module.css';

// Shown on every page: a few links, the verbatim Fan Content disclaimer and the Scryfall credit.
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.text}>
          {copy.footerLinks.free} <a href={KOFI_URL} target="_blank" rel="noreferrer" className={styles.link}>{copy.footerLinks.coffee}</a>
        </p>
        <nav aria-label={copy.footerLinks.label} className={styles.links}>
          <Link to="/about" className={styles.link}>{copy.footerLinks.about}</Link>
          <Link to="/privacy" className={styles.link}>{copy.footerLinks.privacy}</Link>
          <Link to="/walkthrough" className={styles.link}>{copy.footerLinks.walkthrough}</Link>
          <Link to="/kit" className={styles.link}>{copy.footerLinks.kit}</Link>
        </nav>
        <p className={styles.text} data-testid="fan-content-disclaimer">{copy.footer.fanContentDisclaimer}</p>
        <p className={styles.text}>
          <a href={copy.footer.scryfallUrl} target="_blank" rel="noreferrer" className={styles.link}>{copy.footer.scryfallCredit}</a>
        </p>
      </div>
    </footer>
  );
}
