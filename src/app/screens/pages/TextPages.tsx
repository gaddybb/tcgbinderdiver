// About, Support, Privacy and More: pages of plain text and links.
import { useAnalytics } from '../../analytics/AnalyticsProvider';
import { Button } from '../../components';
import { copy } from '../../copy/en';
import { isOn } from '../../flags';
import { KOFI_URL } from '../../links';
import { Link } from '../../router';
import { PageIntro, TextSection } from './PageParts';
import styles from './Pages.module.css';

export function About() {
  const t = copy.aboutPage;
  return (
    <div className={styles.page}>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <TextSection title={t.whatTitle}><p className={styles.text}>{t.whatText}</p></TextSection>
      <TextSection title={t.howTitle}><p className={styles.text}>{t.howText}</p></TextSection>
      <TextSection title={t.whoTitle}><p className={styles.text}>{t.whoText}</p></TextSection>
      <TextSection title={t.creditsTitle}>
        <ul className={styles.list}>{t.credits.map(credit => <li key={credit}>{credit}</li>)}</ul>
        <p className={styles.text}>{copy.footer.fanContentDisclaimer}</p>
      </TextSection>
      <TextSection title={t.contactTitle}>
        <p className={styles.text}>{t.contactLead} <a href={`mailto:${t.contactText}`}>{t.contactText}</a></p>
      </TextSection>
    </div>
  );
}

export function Support() {
  const t = copy.supportPage;
  return (
    <div className={styles.page}>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <TextSection title={t.tipTitle}>
        <p className={styles.text}>{t.tipText}</p>
        <p className={styles.text}><a href={KOFI_URL} target="_blank" rel="noreferrer">{t.tipAction}</a></p>
      </TextSection>
      <TextSection title={t.otherTitle}>
        <ul className={styles.list}>
          <li>{t.share}</li>
          <li>{t.feedback} <a href={`mailto:${t.feedbackLink}`}>{t.feedbackLink}</a></li>
          {isOn('affiliateLinks') && <li>{t.affiliate}</li>}
        </ul>
      </TextSection>
      <TextSection title={t.goTitle}><p className={styles.text}>{t.goText}</p></TextSection>
    </div>
  );
}

// A plain-language draft: have it reviewed before launch. A section about something the app does not do yet (analytics,
// store search, affiliate links) appears only when its feature is on.
export function Privacy() {
  const t = copy.privacyPage;
  const s = t.sections;
  const analytics = useAnalytics();
  return (
    <div className={styles.page}>
      <PageIntro eyebrow={t.eyebrow} title={t.title} />
      <p className={styles.text}>{t.updated} {t.lead}</p>
      <TextSection title={s.device.title}><p className={styles.text}>{s.device.text}</p></TextSection>
      {analytics.available && (
        <TextSection title={s.analytics.title}>
          <p className={styles.text}>{s.analytics.text}</p>
          <div><Button variant="secondary" onClick={analytics.reopen}>{copy.consent.change}</Button></div>
        </TextSection>
      )}
      <TextSection title={s.cards.title}><p className={styles.text}>{s.cards.text}</p></TextSection>
      {isOn('storeMap') && <TextSection title={s.stores.title}><p className={styles.text}>{s.stores.text}</p></TextSection>}
      {isOn('affiliateLinks') && <TextSection title={s.affiliate.title}><p className={styles.text}>{s.affiliate.text}</p></TextSection>}
      <TextSection title={s.accounts.title}><p className={styles.text}>{s.accounts.text}</p></TextSection>
      <TextSection title={s.contact.title}><p className={styles.text}>{s.contact.text}</p></TextSection>
    </div>
  );
}

// The phone's More tab: the pages that are not one of the three main ones.
export function More() {
  const t = copy.more;
  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>{t.title}</h1>
      <ul className={styles.menuList}>
        <li><Link to="/walkthrough">{t.walkthrough}</Link></li>
        <li><Link to="/support">{t.support}</Link></li>
        <li><Link to="/about">{t.about}</Link></li>
        <li><Link to="/privacy">{t.privacy}</Link></li>
        <li><Link to="/kit">{t.kit}</Link></li>
      </ul>
    </div>
  );
}
