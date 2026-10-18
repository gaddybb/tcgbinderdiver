import { Button } from '../components';
import { copy } from '../copy/en';
import { Link } from '../router';
import { useAnalytics } from './AnalyticsProvider';
import styles from './ConsentBanner.module.css';

// Asks once, along the bottom of the screen, before any analytics is loaded. "No thanks" is as easy as "Allow".
export function ConsentBanner() {
  const { choosing, choose } = useAnalytics();
  if (!choosing) return null;
  const t = copy.consent;
  return (
    <section role="region" aria-label={t.label} className={styles.banner}>
      <div className={styles.text}>
        <strong>{t.title}</strong>
        <span>{t.text} <Link to="/privacy">{t.more}</Link></span>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => choose('denied')}>{t.deny}</Button>
        <Button onClick={() => choose('granted')}>{t.allow}</Button>
      </div>
    </section>
  );
}
