// The dive plan at /plan: the stops for the lists turned on, in walking order, each with its count, value and verdict.
import { useEffect, useMemo, useRef, useState } from 'react';
import { V1_STORE } from '../../../core/engine/engine';
import type { StopKind } from '../../../core/engine/engine';
import { diveStops, groupByKind, totalCards } from '../../../core/store';
import { Banner, Button, Dialog, EmptyState, ListRow, PageHeader, PullVerdict, Rank, SkeletonRow, StandaloneLink, SummaryBar } from '../../components';
import { copy } from '../../copy/en';
import { useAnalytics } from '../../analytics/AnalyticsProvider';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { useTrip } from '../../data/TripProvider';
import { formatUsd, joinNames } from '../../format';
import { useLayout } from '../../layout/useLayout';
import { navigate } from '../../router';
import screen from '../Screen.module.css';
import styles from './Dive.module.css';
import { BasicsNote } from './BasicsNote';
import { SampleBanner } from './SampleBanner';
import { PullSettingsPanel } from './PullSettingsPanel';
import { Tour } from '../tour/Tour';
import { startDive } from './startDive';
import { useDive } from './useDive';

const t = copy.dive;

// The one line under a stop type's name. The numbers come from the store profile, so a changed cutoff changes the words.
function detailFor(kind: StopKind): string {
  switch (kind) {
    case 'set_binder': return t.kind.set_binder.detail(V1_STORE.setBinderMaxAgeYears);
    case 'display_case': return t.kind.display_case.detail(V1_STORE.displayCaseMin);
    case 'commander_box': return t.kind.commander_box.detail();
    case 'value_binder': return t.kind.value_binder.detail();
    case 'ask_associate': return t.kind.ask_associate.detail();
  }
}

export function DivePlan() {
  const phone = useLayout() === 'phone';
  const dive = useDive();
  const store = useStoreSettings();
  const analytics = useAnalytics();
  const [panel, setPanel] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const tripApi = useTrip();
  const active = tripApi.trip !== null && tripApi.trip.endedAt === undefined;

  const stops = useMemo(() => diveStops(dive.listPlan.plan, store.settings.pull), [dive.listPlan.plan, store.settings.pull]);
  const groups = groupByKind(stops);
  const total = totalCards(stops);
  const noBinder = [...dive.listPlan.targets].filter(([, target]) => target.kind === 'no_binder').map(([key]) => dive.data.records.get(key)?.summary.name ?? key);
  // An empty wishlist is on by default; naming it as part of the dive would only be noise.
  const contributing = dive.lists.filter(l => l.entries.some(e => e.status === 'needed'));
  const loading = dive.data.status === 'loading' && dive.data.progress.total > 0;

  // Counted once per visit, when the plan has stops to show.
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current || stops.length === 0) return;
    counted.current = true;
    analytics.track('plan_viewed', { cards: total, stops: stops.length });
  }, [stops.length, total, analytics]);

  const startTrip = () => startDive(tripApi, dive.lists);

  const summaryBar = (
    <SummaryBar
      sticky={phone}
      title={t.listsUsed(joinNames(contributing.map(l => l.name)))}
      detail={active ? undefined : t.startHint}
      action={active ? (
        <span className={styles.toolbar} data-tour="plan-start">
          <Button onClick={() => navigate('/dive')}>{t.resumeDive}</Button>
          <Button variant="text" onClick={() => setConfirmNew(true)}>{t.newTrip}</Button>
        </span>
      ) : (
        <span data-tour="plan-start">
          <Button disabled={total === 0} onClick={startTrip}>{t.startDive}</Button>
        </span>
      )}
    />
  );

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(total, stops.length)}
        actions={
          <span className={styles.toolbar} data-tour="plan-settings">
            <Button variant="secondary" onClick={() => setPanel(true)}>{t.pullSettings}</Button>
            <Button variant="secondary" onClick={() => navigate('/groups')}>{t.binderGroups}</Button>
          </span>
        }
      />

      <div className={screen.stack}>
        <StandaloneLink to="/lists">{t.backToLists}</StandaloneLink>
        <SampleBanner />
        {/* At the top on a tablet or desktop, so a long plan never hides it; on a phone it stays pinned to the bottom. */}
        {!phone && dive.ready && dive.lists.length > 0 && summaryBar}

        {!dive.ready ? <SkeletonRow /> : dive.lists.length === 0 ? (
          <EmptyState title={t.empty.title} actions={<Button onClick={() => navigate('/lists')}>{t.empty.action}</Button>}>{t.empty.text}</EmptyState>
        ) : (
          <>
            {loading && <Banner tone="info" title={t.loading(dive.data.progress.done, dive.data.progress.total)} />}
            {dive.data.status === 'error' && (
              <Banner tone="error" title={t.error.title} actions={<Button variant="secondary" onClick={dive.data.retry}>{t.error.retry}</Button>}>
                {t.error.detail}
              </Banner>
            )}

            <BasicsNote count={dive.listPlan.plan.skipped.length} />

            {dive.neededCount === 0 ? (
              <EmptyState title={t.nothingNeeded.title}>{t.nothingNeeded.text}</EmptyState>
            ) : (
              <>
                <div role="list" aria-label={t.stopsLabel} className={screen.stack} data-tour="plan-stops">
                  {groups.map(group => (
                    <section key={group.kind} role="listitem" className={styles.section} aria-labelledby={`kind-${group.kind}`}>
                      <div className={styles.sectionHead}>
                        <h2 id={`kind-${group.kind}`} className={styles.sectionTitle}>{t.kind[group.kind].title}</h2>
                        <p className={styles.sectionDetail}>{detailFor(group.kind)}</p>
                      </div>
                      <ul className={screen.plain}>
                        {group.stops.map(stop => (
                          <ListRow
                            key={stop.id}
                            lead={<Rank n={stops.indexOf(stop) + 1} />}
                            title={stop.label}
                            subtitle={t.stopSummary(stop.cards, formatUsd(stop.value))}
                            trailing={<PullVerdict verdict={stop.verdict} />}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>

                {noBinder.length > 0 && (
                  <Banner tone="info" title={t.noBinder.title(noBinder.length)} actions={<Button variant="secondary" onClick={() => navigate('/groups')}>{t.noBinder.checkGroups}</Button>}>
                    {t.noBinder.detail}
                    <ul className={styles.names}>{noBinder.map(name => <li key={name}>{name}</li>)}</ul>
                  </Banner>
                )}
              </>
            )}
            {phone && summaryBar}
          </>
        )}
      </div>

      {dive.ready && dive.neededCount > 0 && <Tour id="plan" />}
      <PullSettingsPanel open={panel} onClose={() => setPanel(false)} stops={stops} />

      <Dialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title={t.newTripDialog.title}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmNew(false)}>{t.newTripDialog.keep}</Button>
            <Button onClick={() => { setConfirmNew(false); startTrip(); }}>{t.newTripDialog.start}</Button>
          </>
        }
      >
        {t.newTripDialog.body}
      </Dialog>
    </>
  );
}
