import { copy } from '../copy/en';
import styles from './Footer.module.css';

// Shown on every page: the verbatim Fan Content disclaimer and the Scryfall credit.
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.text} data-testid="fan-content-disclaimer">{copy.footer.fanContentDisclaimer}</p>
        <p className={styles.text}>
          <a href={copy.footer.scryfallUrl} target="_blank" rel="noreferrer">{copy.footer.scryfallCredit}</a>
        </p>
      </div>
    </footer>
  );
}
