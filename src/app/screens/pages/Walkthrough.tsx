import { useState } from 'react';
import { Button } from '../../components';
import { copy } from '../../copy/en';
import { useLayout } from '../../layout/useLayout';
import { navigate } from '../../router';
import { TourPlayer } from '../tour/Tour';
import { SampleDeckButton } from './SampleDeckButton';
import { PageIntro } from './PageParts';
import styles from './Pages.module.css';

const t = copy.walkthroughPage;

export function Walkthrough() {
  const wide = useLayout() !== 'phone';
  const [replay, setReplay] = useState(false);

  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead} />

      <ol className={styles.walk}>
        {t.steps.map((step, i) => (
          <li key={step.title} className={`${styles.walkItem} ${wide ? styles.walkWide : ''}`}>
            <div>
              <span aria-hidden="true" className={styles.stepNo}>{i + 1}</span>
              <h2 className={styles.h2}>{step.title}</h2>
              <p className={styles.text}>{step.text}</p>
            </div>
            <div role="img" aria-label={step.shot} className={styles.shot}>{step.shot}</div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="faq-title">
        <h2 id="faq-title" className={styles.h2}>{t.faqTitle}</h2>
        {t.faq.map(item => (
          <details key={item.q} className={styles.faq}>
            <summary>{item.q}</summary>
            <p className={styles.text}>{item.a}</p>
          </details>
        ))}
      </section>

      <section className={styles.intro}>
        <h2 className={styles.title}>{t.readyTitle}</h2>
        <div className={styles.actions}>
          <Button size="lg" onClick={() => navigate('/import')}>{t.plan}</Button>
          <SampleDeckButton size="lg" />
          <Button variant="secondary" size="lg" onClick={() => setReplay(true)}>{t.replay}</Button>
        </div>
      </section>

      {replay && <TourPlayer id="dive" onDone={() => setReplay(false)} />}
    </div>
  );
}
