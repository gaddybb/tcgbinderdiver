// The home page: the pitch, a box to paste a decklist into, and the four steps in a line each.
import { useState } from 'react';
import { Button, GameAnchor, Input, StandaloneLink } from '../components';
import { copy } from '../copy/en';
import { useLayout } from '../layout/useLayout';
import { navigate } from '../router';
import { setImportText } from './import/handoff';
import styles from './pages/Pages.module.css';

const t = copy.homePage;

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
      <section className={styles.hero} aria-label={copy.app.name}>
        <GameAnchor />
        <p className={styles.eyebrow}>{t.eyebrow(copy.games.magic)}</p>
        <h1 className={phone ? styles.heroTitleSmall : styles.heroTitle}>{t.title}</h1>
        <p className={styles.lead}>{t.lead}</p>
        <form className={styles.form} onSubmit={e => { e.preventDefault(); plan(); }}>
          <Input label={t.formLabel} multiline rows={4} placeholder={t.placeholder} value={text} onChange={e => setText(e.target.value)} />
          <Button size="lg" onClick={plan}>{t.plan}</Button>
        </form>
        <p className={styles.text}>{t.firstDive} <StandaloneLink to="/walkthrough">{t.takeWalkthrough}</StandaloneLink></p>
      </section>

      <section className={styles.intro} aria-labelledby="why-title">
        <p className={styles.eyebrow}>{t.whyEyebrow}</p>
        <h2 id="why-title" className={styles.title}>{t.whyTitle}</h2>
        <p className={styles.lead}>{t.whyLead}</p>
        <ol className={styles.steps}>
          {t.steps.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span aria-hidden="true" className={styles.stepNo}>{i + 1}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.text}>{step.text}</p>
            </li>
          ))}
        </ol>
        <StandaloneLink to="/walkthrough">{t.fullWalkthrough}</StandaloneLink>
      </section>
    </div>
  );
}
