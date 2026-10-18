// The trip summary at /trip: what was found and in how many places, then the way to buy or find the rest. On a tablet and
// desktop it is two columns (what is left on the left; Buy the rest and nearby stores beside it, in view straight away); on a
// phone the buttons and both panels come before the cards still wanted.
import { MASS_ENTRY_URL, massEntryUrl } from '../../../core/buy';
import { massEntryText, tripSummary } from '../../../core/trip';
import { Banner, Button, CardImage, EmptyState, SkeletonRow, isColorCategory, useToast } from '../../components';
import type { ColorCategory } from '../../components';
import { useAnalytics } from '../../analytics/AnalyticsProvider';
import { copyText } from '../../clipboard';
import { copy } from '../../copy/en';
import { isOn } from '../../flags';
import { NEARBY_STORES_URL, buyUrl } from '../../links';
import { useConnector } from '../../data/CardDataProvider';
import { useTrip } from '../../data/TripProvider';
import { useLayout } from '../../layout/useLayout';
import { navigate } from '../../router';
import screen from '../Screen.module.css';
import styles from './StoreDive.module.css';
import ends from './TripEnd.module.css';
import { InstallBanner } from './InstallBanner';
import { useTripPlan } from './useTripPlan';

const t = copy.tripEnd;

export function TripSummary() {
  const toast = useToast();
  const analytics = useAnalytics();
  const connector = useConnector();
  const wide = useLayout() !== 'phone';
  const { clear } = useTrip();
  const { ready, trip, cards, plan, data } = useTripPlan();

  if (!ready) return <SkeletonRow />;
  if (!trip || !cards || !plan) {
    return (
      <>
        <h1 className={ends.title}>{t.title}</h1>
        <EmptyState title={t.noTrip.title} actions={<Button onClick={() => navigate('/plan')}>{t.noTrip.action}</Button>}>{t.noTrip.text}</EmptyState>
      </>
    );
  }

  const summary = tripSummary(trip, plan, cards.parts);
  const loading = data.status === 'loading' && data.progress.total > 0;
  const prefilled = massEntryUrl(summary.left);

  const copyLeft = async () => {
    const ok = await copyText(massEntryText(summary.left));
    toast.show({ message: ok ? t.buy.copied : t.buy.copyFailed });
  };
  const copyList = () => { analytics.track('buy_rest_tapped', { cards: summary.leftCopies }); void copyLeft(); };
  // Opens TCGplayer Mass Entry with the list already in it; a list too long for an address is copied first, to paste there.
  const buy = () => {
    analytics.track('buy_rest_tapped', { cards: summary.leftCopies });
    if (prefilled) { window.open(buyUrl(prefilled), '_blank', 'noopener,noreferrer'); return; }
    void copyLeft();
    window.open(buyUrl(MASS_ENTRY_URL), '_blank', 'noopener,noreferrer');
  };

  const actions = (
    <div className={styles.chips}>
      <Button variant="secondary" onClick={() => navigate('/lists')}>{t.backToLists}</Button>
      <Button onClick={() => { clear(); navigate('/plan'); }}>{t.newTrip}</Button>
    </div>
  );

  const buyPanel = !loading && summary.left.length > 0 && (
    <section className={ends.panel} aria-label={t.buy.title}>
      <h2 className={styles.stopTitle}>{t.buy.title}</h2>
      <p className={styles.note}>{prefilled ? t.buy.detailFilled(summary.leftCopies) : t.buy.buyNote}</p>
      <div className={styles.chips}>
        <Button size="lg" onClick={buy}>{t.buy.buyOnTcgplayer(summary.leftCopies)}</Button>
        <Button variant="secondary" onClick={copyList}>{t.buy.copy(summary.leftCopies)}</Button>
      </div>
      {isOn('affiliateLinks') && <p className={styles.note}>{copy.affiliate.note}</p>}
    </section>
  );

  const storesPanel = (
    <section className={ends.panel} aria-label={t.stores.title}>
      <h2 className={styles.stopTitle}>{t.stores.title}</h2>
      <p className={styles.note}>{t.stores.detail}</p>
      <div>
        <Button variant="secondary" onClick={() => { window.open(NEARBY_STORES_URL, '_blank', 'noopener,noreferrer'); }}>{t.stores.action}</Button>
      </div>
    </section>
  );

  const leftHeading = summary.left.length > 0 ? t.left(summary.leftCopies) : t.nothingLeft;
  // While card data is still arriving the counts would be wrong (nothing found, nothing left), so they wait for it.
  const leftover = loading ? null : (
    <section aria-label={leftHeading} className={ends.left}>
      <p className={styles.counterName}>{leftHeading}</p>
      <ul className={ends.cards}>
        {summary.left.map(card => {
          const record = data.records.get(card.cardKey);
          const category = record ? connector.sortCategory(record.summary) : 'Colorless';
          const edge: ColorCategory = isColorCategory(category) ? category : 'Colorless';
          return (
            <li key={card.cardKey} className={ends.card}>
              <CardImage fluid name={card.name} src={record ? (record.summary.imageNormal ?? record.summary.imageSmall) : null} edge={edge} />
              <span className={ends.cardName}>{card.name}</span>
              <span className={styles.note}>{t.copies(card.copies)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div className={screen.stack}>
      <div className={ends.head}>
        <h1 className={ends.title}>{t.title}</h1>
        {!loading && <p className={ends.found}>{summary.foundCopies > 0 ? t.found(summary.foundCopies, summary.searched) : t.foundNothing}</p>}
      </div>
      {loading && <Banner tone="info" title={copy.storeDive.loading(data.progress.done, data.progress.total)} />}
      <InstallBanner />

      {wide ? (
        <div className={ends.columns}>
          <div className={ends.main}>
            {leftover}
            {actions}
          </div>
          <aside className={ends.side} aria-label={t.sideLabel}>
            {buyPanel}
            {storesPanel}
          </aside>
        </div>
      ) : (
        <>
          {actions}
          {buyPanel}
          {storesPanel}
          {leftover}
        </>
      )}
    </div>
  );
}
