// The trip summary at /trip: what was found, what is left, and the leftovers ready to paste into TCGplayer Mass Entry.
import { massEntryText, tripSummary } from '../../../core/trip';
import { Banner, Button, EmptyState, PageHeader, SkeletonRow, useToast } from '../../components';
import { copyText } from '../../clipboard';
import { copy } from '../../copy/en';
import { useTrip } from '../../data/TripProvider';
import { navigate } from '../../router';
import screen from '../Screen.module.css';
import styles from './StoreDive.module.css';
import { useTripPlan } from './useTripPlan';

const t = copy.tripEnd;

export function TripSummary() {
  const toast = useToast();
  const { clear } = useTrip();
  const { ready, trip, cards, plan, data } = useTripPlan();

  if (!ready) return <SkeletonRow />;
  if (!trip || !cards || !plan) {
    return (
      <>
        <PageHeader title={t.title} />
        <EmptyState title={t.noTrip.title} actions={<Button onClick={() => navigate('/plan')}>{t.noTrip.action}</Button>}>{t.noTrip.text}</EmptyState>
      </>
    );
  }

  const summary = tripSummary(trip, plan, cards.parts);
  const loading = data.status === 'loading' && data.progress.total > 0;

  const copyLeft = async () => {
    const ok = await copyText(massEntryText(summary.left));
    toast.show({ message: ok ? t.buy.copied : t.buy.copyFailed });
  };

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={summary.foundCopies > 0 ? t.found(summary.foundCopies, summary.searched) : t.foundNothing}
      />
      <div className={screen.stack}>
        {loading && <Banner tone="info" title={copy.storeDive.loading(data.progress.done, data.progress.total)} />}

        <section className={styles.rows} aria-label={summary.left.length > 0 ? t.left(summary.leftCopies) : t.nothingLeft}>
          <p className={styles.counterName}>{summary.left.length > 0 ? t.left(summary.leftCopies) : t.nothingLeft}</p>
          <ul className={styles.summaryList}>
            {summary.left.map(card => (
              <li key={card.cardKey} className={styles.summaryRow}>
                <span>{card.name}</span>
                <span className={styles.note}>{t.copies(card.copies)}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.chips}>
          <Button variant="secondary" onClick={() => navigate('/lists')}>{t.backToLists}</Button>
          <Button onClick={() => { clear(); navigate('/plan'); }}>{t.newTrip}</Button>
        </div>

        {summary.left.length > 0 && (
          <section className={styles.rows} aria-label={t.buy.title}>
            <h2 className={styles.stopTitle}>{t.buy.title}</h2>
            <p className={styles.note}>{t.buy.detail(summary.leftCopies)}</p>
            <div>
              <Button onClick={() => { void copyLeft(); }}>{t.buy.copy(summary.leftCopies)}</Button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
