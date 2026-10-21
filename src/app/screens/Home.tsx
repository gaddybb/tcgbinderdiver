// The home page: the pitch, a box to paste a decklist into, why it helps, the four steps in a line each, and Ko-fi.
import { useState } from 'react';
import { Button, Input, StandaloneLink } from '../components';
import { copy } from '../copy/en';
import { KOFI_URL } from '../links';
import { useLayout } from '../layout/useLayout';
import { navigate } from '../router';
import { InstallBanner } from './dive/InstallBanner';
import { setImportText } from './import/handoff';
import { SampleDeckButton } from './pages/SampleDeckButton';
import styles from './pages/Pages.module.css';

const t = copy.homePage;
// Where the bubbles rise from, as a share of the width; they keep to the edges, away from the text.
const BUBBLES = [8, 14, 22, 71, 83, 91];

export function Home() {
  const phone = useLayout() === 'phone';
  const [text, setText] = useState('');

  // The pasted list goes to the import flow in memory; nothing is saved until the player has named it and looked it up.
  const plan = () => {
    setImportText(text);
    navigate('/import');
  };

  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <div className={styles.heroBackdrop} aria-hidden="true">
        <div className={styles.heroDepth} />
        <div className={styles.heroTint} />
        <div className={styles.bubbles}>{BUBBLES.map((left, i) => <span key={left} style={{ left: `${left}%`, animationDelay: `${i * 1.7}s` }} />)}</div>
      </div>
      <InstallBanner />
      <section className={styles.hero} aria-label={copy.app.name}>
        <h1 className={phone ? styles.heroTitleSmall : styles.heroTitle}>{t.title.slice(0, t.title.length - t.titleAccent.length)}<span className={styles.accent}>{t.titleAccent}</span></h1>
        <p className={styles.primer}>{t.primer}</p>
        <form className={styles.form} onSubmit={e => { e.preventDefault(); plan(); }}>
          <Input label={t.formLabel} multiline rows={4} placeholder={t.placeholder} value={text} onChange={e => setText(e.target.value)} />
          <div className={`${styles.formActions} ${phone ? styles.formActionsPhone : ''}`}>
            <Button size="lg" onClick={plan}>{t.plan}</Button>
            <SampleDeckButton size="lg" />
            <p className={styles.formNote}>{t.firstDive} <StandaloneLink to="/walkthrough">{t.takeWalkthrough}</StandaloneLink></p>
          </div>
        </form>
        <Button variant="text" onClick={() => document.getElementById('why-title')?.scrollIntoView?.({ behavior: 'smooth' })}>
          {t.whyCue} <span aria-hidden="true">↓</span>
        </Button>
      </section>

      <section className={styles.why} aria-labelledby="why-title">
        <div className={styles.whyHead}>
          <div>
            <p className={styles.eyebrow}>{t.whyEyebrow}</p>
            <h2 id="why-title" className={styles.whyTitle}>{t.whyTitle}</h2>
          </div>
          <p className={styles.whyLead}>{t.whyLead}</p>
        </div>
        <ol className={styles.steps}>
          {t.steps.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span aria-hidden="true" className={styles.stepNo}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
        <div className={styles.whyFoot}>
          <p className={styles.stepsNote}>{t.stepsNote}</p>
          <StandaloneLink to="/walkthrough">{t.fullWalkthrough}</StandaloneLink>
        </div>
      </section>

      <section className={styles.support}>
        <p className={styles.supportText}>{t.support.text}</p>
        <Button variant="secondary" onClick={() => { window.open(KOFI_URL, '_blank', 'noopener,noreferrer'); }}>{t.support.action}</Button>
      </section>
    </div>
  );
}
