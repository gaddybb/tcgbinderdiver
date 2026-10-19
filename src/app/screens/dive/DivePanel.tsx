// The dive plan beside a list: lists in this dive, the stops with their verdicts, and the binder groups, with the way to
// start the store dive. On a phone it opens and closes so the cards stay in reach.
import { useMemo, useState } from 'react';
import type { CardRecord } from '../../../core/cards';
import { V1_STORE } from '../../../core/engine/engine';
import { diveStops, setsUsed } from '../../../core/store';
import { Button, ListRow, PullVerdict, Rank, Switch } from '../../components';
import { copy } from '../../copy/en';
import { useLists } from '../../data/ListsProvider';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { useTrip } from '../../data/TripProvider';
import { formatUsd } from '../../format';
import { useLayout } from '../../layout/useLayout';
import { navigate } from '../../router';
import screen from '../Screen.module.css';
import styles from './Dive.module.css';
import { DiveQr } from './DiveQr';
import { divePlanFor } from './planData';
import { PullSettingsPanel } from './PullSettingsPanel';
import { startDive } from './startDive';

const t = copy.divePanel;

interface DivePanelProps {
  compact: boolean;
  records: ReadonlyMap<string, CardRecord>;   // card data the screen has already loaded, so nothing is fetched twice
}

export function DivePanel({ compact, records }: DivePanelProps) {
  const phone = useLayout() === 'phone';
  const lists = useLists();
  const store = useStoreSettings();
  const tripApi = useTrip();
  const next = useMemo(() => lists.lists.filter(l => l.inNextDive), [lists.lists]);
  const dive = useMemo(() => divePlanFor(next, records, store.profile, lists.now()), [next, records, store.profile, lists]);
  const [open, setOpen] = useState(!compact);
  const [settings, setSettings] = useState(false);

  const stops = useMemo(() => diveStops(dive.listPlan.plan, store.settings.pull), [dive.listPlan.plan, store.settings.pull]);
  const noBinder = [...dive.listPlan.targets.values()].filter(target => target.kind === 'no_binder').length;
  const names = useMemo(() => new Map(setsUsed(dive.needed).map(s => [s.code, s.name])), [dive.needed]);
  const nameOf = (code: string) => names.get(code) ?? code.toUpperCase();
  const active = tripApi.trip !== null && tripApi.trip.endedAt === undefined;
  const shown = open || !compact;

  return (
    <aside className={styles.panelCard} aria-label={t.title}>
      <div className={styles.toolbar}>
        <h2 className={styles.sectionTitle}>{t.title}</h2>
        <Button variant="secondary" onClick={() => setSettings(true)}>{copy.dive.pullSettings}</Button>
        {compact && <Button variant="text" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? t.hide : t.show}</Button>}
      </div>

      {!compact || !open ? <p className={styles.sectionDetail}>{t.summary(stops.reduce((n, s) => n + s.cards, 0), stops.length)}</p> : null}
      {compact && !open && <Button onClick={() => navigate(active ? '/dive' : '/plan')}>{active ? copy.dive.resumeDive : t.build}</Button>}

      {shown && (
        <>
          <section className={styles.section} aria-label={t.listsTitle}>
            <h3 className={styles.subTitle}>{t.listsTitle}</h3>
            <ul className={screen.plain}>
              {lists.lists.map(list => {
                const needed = list.entries.filter(e => e.status === 'needed').length;
                return (
                  <li key={list.id} className={styles.setRow}>
                    <Switch label={t.listLabel(list.name, needed)} checked={list.inNextDive} onChange={on => { void lists.setInNextDive(list.id, on); }} />
                  </li>
                );
              })}
            </ul>
          </section>

          {stops.length > 0 && (
            <ul className={screen.plain} aria-label={copy.dive.stopsLabel}>
              {stops.map((stop, i) => (
                <ListRow
                  key={stop.id}
                  lead={<Rank n={i + 1} />}
                  title={stop.label}
                  subtitle={copy.dive.stopSummary(stop.cards, formatUsd(stop.value))}
                  trailing={<PullVerdict verdict={stop.verdict} />}
                />
              ))}
            </ul>
          )}

          {noBinder > 0 && <Button variant="text" onClick={() => navigate('/plan')}>{t.noBinder(noBinder)}</Button>}

          {active ? (
            <Button onClick={() => navigate('/dive')}>{copy.dive.resumeDive}</Button>
          ) : (
            <Button disabled={stops.length === 0} onClick={() => startDive(tripApi, next)}>{copy.dive.startDive}</Button>
          )}
          <Button variant="text" onClick={() => navigate('/plan')}>{t.fullPlan}</Button>

          {(!compact || !phone) && <DiveQr />}

          <section className={styles.section} aria-label={t.groupsTitle}>
            <div className={styles.toolbar}>
              <h3 className={styles.subTitle}>{t.groupsTitle}</h3>
              <Button variant="text" onClick={() => navigate('/groups')}>{t.editGroups}</Button>
            </div>
            <p className={styles.sectionDetail}>{t.groupsLead(V1_STORE.setBinderMaxAgeYears)}</p>
            {store.settings.binderGroups.length === 0 && store.settings.notCarried.length === 0 ? (
              <p className={styles.sectionDetail}>{t.noGroups}</p>
            ) : (
              <ul className={screen.plain}>
                {store.settings.binderGroups.filter(g => g.setCodes.length > 0).map(g => (
                  <li key={g.id} className={styles.sectionDetail}>{t.groupLine(g.setCodes.map(nameOf).join(', '), g.name)}</li>
                ))}
                {store.settings.notCarried.length > 0 && (
                  <li className={styles.sectionDetail}>{t.groupLine(store.settings.notCarried.map(nameOf).join(', '), copy.groups.notCarried.title)}</li>
                )}
              </ul>
            )}
          </section>
        </>
      )}

      <PullSettingsPanel open={settings} onClose={() => setSettings(false)} stops={stops} />
    </aside>
  );
}
