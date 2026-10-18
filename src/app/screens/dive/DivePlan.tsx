// The dive plan at /plan: the stops for the lists turned on, in walking order, each with its count, value and verdict.
import { useMemo, useState } from 'react';
import { V1_STORE } from '../../../core/engine/engine';
import type { StopKind } from '../../../core/engine/engine';
import { diveStops, groupByKind, totalCards } from '../../../core/store';
import { Banner, Button, EmptyState, ListRow, PageHeader, PullVerdict, Rank, SkeletonRow, StandaloneLink, SummaryBar } from '../../components';
import { copy } from '../../copy/en';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { formatUsd, joinNames } from '../../format';
import { useLayout } from '../../layout/useLayout';
import { navigate } from '../../router';
import screen from '../Screen.module.css';
import styles from './Dive.module.css';
import { PullSettingsPanel } from './PullSettingsPanel';
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
  const [panel, setPanel] = useState(false);

  const stops = useMemo(() => diveStops(dive.listPlan.plan, store.settings.pull), [dive.listPlan.plan, store.settings.pull]);
  const groups = groupByKind(stops);
  const total = totalCards(stops);
  const noBinder = [...dive.listPlan.targets].filter(([, target]) => target.kind === 'no_binder').map(([key]) => dive.data.records.get(key)?.summary.name ?? key);
  // An empty wishlist is on by default; naming it as part of the dive would only be noise.
  const contributing = dive.lists.filter(l => l.entries.some(e => e.status === 'needed'));
  const loading = dive.data.status === 'loading' && dive.data.progress.total > 0;

  const summaryBar = (
    <SummaryBar
      sticky={phone}
      title={t.listsUsed(joinNames(contributing.map(l => l.name)))}
      action={<Button disabled title={t.startDiveSoon}>{t.startDive}</Button>}
    />
  );

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(total, stops.length)}
        actions={
          <span className={styles.toolbar}>
            <Button variant="secondary" onClick={() => setPanel(true)}>{t.pullSettings}</Button>
            <Button variant="secondary" onClick={() => navigate('/groups')}>{t.binderGroups}</Button>
          </span>
        }
      />

      <div className={screen.stack}>
        <StandaloneLink to="/lists">{t.backToLists}</StandaloneLink>

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

            {dive.neededCount === 0 ? (
              <EmptyState title={t.nothingNeeded.title}>{t.nothingNeeded.text}</EmptyState>
            ) : (
              <>
                <div role="list" aria-label={t.stopsLabel} className={screen.stack}>
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
            {summaryBar}
          </>
        )}
      </div>

      <PullSettingsPanel open={panel} onClose={() => setPanel(false)} stops={stops} />
    </>
  );
}
