// The store dive at /dive: one binder at a time, in walking order, with the cards to find there.
import { useEffect, useState } from 'react';
import { filterCards, PRICE_FILTERS } from '../../../core/filter';
import type { PriceFilter } from '../../../core/filter';
import { pullVerdict } from '../../../core/engine/engine';
import type { PlanStop } from '../../../core/engine/engine';
import { SORT_MODES, sortCards } from '../../../core/sort';
import type { SortMode } from '../../../core/sort';
import {
  finishBinder, finishedStops, foundCopies, markAllFound, markFound, markNotAvailable, reopenBinder, setListOn,
  stopLabel, tripSummary, undoAllFound, undoFound,
} from '../../../core/trip';
import {
  Banner, Button, CardTile, ColorFilter, Chip, Dialog, EmptyState, isColorCategory, PageHeader, ProgressBar, PullVerdict, Select, SkeletonRow,
  SummaryBar, useToast,
} from '../../components';
import type { ColorCategory } from '../../components';
import { copy } from '../../copy/en';
import { useConnector } from '../../data/CardDataProvider';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { useTrip } from '../../data/TripProvider';
import type { CardRecord } from '../../../core/cards';
import { formatUsd } from '../../format';
import { useLayout } from '../../layout/useLayout';
import { navigate } from '../../router';
import screen from '../Screen.module.css';
import { CounterStop } from './CounterStop';
import styles from './StoreDive.module.css';
import { useTripPlan } from './useTripPlan';

const t = copy.storeDive;
const FLIP = new Set(['set_binder', 'commander_box']);
type DiveSort = 'binder' | SortMode;

export function StoreDive() {
  const layout = useLayout();
  const phone = layout === 'phone';
  const connector = useConnector();
  const toast = useToast();
  const store = useStoreSettings();
  const { ready, trip, lists, data, cards, plan, update } = useTripPlan();
  const { end } = useTrip();

  const [selected, setSelected] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<DiveSort>('binder');
  const [price, setPrice] = useState<PriceFilter>('any');
  const [colors, setColors] = useState<ColorCategory[]>([]);
  const [ending, setEnding] = useState(false);

  const ended = trip?.endedAt !== undefined;
  useEffect(() => { if (ended) navigate('/trip', { replace: true }); }, [ended]);

  if (!ready || ended) return <SkeletonRow />;
  if (!trip || !cards || !plan) {
    return (
      <>
        <PageHeader title={t.title} />
        <EmptyState title={t.noTrip.title} actions={<Button onClick={() => navigate('/plan')}>{t.noTrip.action}</Button>}>{t.noTrip.text}</EmptyState>
      </>
    );
  }

  const stops = plan.stops;
  const current: PlanStop | undefined = stops.find(s => s.stop.id === selected) ?? stops[0];
  const index = current ? stops.indexOf(current) : -1;
  const finished = finishedStops(trip).filter(id => !stops.some(s => s.stop.id === id));
  const categoryOf = (record: CardRecord) => connector.sortCategory(record.summary);
  const loading = data.status === 'loading' && data.progress.total > 0;
  const summary = tripSummary(trip, plan, cards.parts);

  const go = (id: string | undefined) => setSelected(id ?? null);
  const pick = (value: string) => {
    if (value.startsWith('finished:')) {
      const id = value.slice('finished:'.length);
      update(tr => reopenBinder(tr, id, cards.parts));
      toast.show({ message: t.reopened(stopLabel(plan, id) ?? id) });
      go(id);
    } else go(value);
  };

  const finish = (stop: PlanStop, message: (label: string) => string) => {
    update(tr => finishBinder(tr, stop.stop.id, cards.parts));
    toast.show({ message: message(stop.stop.label) });
    go(stops[index + 1]?.stop.id ?? stops[index - 1]?.stop.id);
  };

  const listsWithCards = lists.filter(l => l.entries.some(e => e.status === 'needed'));
  const order = lists.map(l => l.id);

  const header = (
    <PageHeader
      title={t.title}
      actions={
        <span className={styles.chips}>
          <Button variant="secondary" onClick={() => navigate('/plan')}>{t.backToPlan}</Button>
          <Button variant="secondary" onClick={() => setEnding(true)}>{t.endTrip}</Button>
        </span>
      }
    />
  );

  const endDialog = (
    <Dialog
      open={ending}
      onClose={() => setEnding(false)}
      title={t.endDialog.title}
      actions={
        <>
          <Button variant="secondary" onClick={() => setEnding(false)}>{t.endDialog.keep}</Button>
          <Button onClick={() => { setEnding(false); end(); navigate('/trip'); }}>{t.endDialog.end}</Button>
        </>
      }
    >
      {t.endDialog.body(summary.searched, Math.max(summary.stops, summary.searched), summary.leftCopies)}
    </Dialog>
  );

  if (!current) {
    return (
      <>
        {header}
        <div className={screen.stack}>
          {loading && <Banner tone="info" title={t.loading(data.progress.done, data.progress.total)} />}
          <EmptyState title={t.allDone.title} actions={<Button onClick={() => setEnding(true)}>{t.allDone.action}</Button>}>{t.allDone.text}</EmptyState>
        </div>
        {endDialog}
      </>
    );
  }

  const verdict = pullVerdict(current, store.settings.pull);
  const flip = FLIP.has(current.stop.kind);

  // Cards at this stop, with the printing to look for here.
  const entries = current.cards.flatMap(({ key, candidate }) => {
    const part = cards.parts.get(key);
    const record = data.records.get(key);
    if (!part || !record) return [];
    const category = categoryOf(record);
    return [{ key, part, record, candidate, edge: (isColorCategory(category) ? category : 'Colorless') as ColorCategory, category }];
  });
  const matching = filterCards(entries, { query: '', price, colors }, e => ({ name: e.record.summary.name, price: e.candidate.price, color: e.edge }));
  const shown = sort === 'binder' ? matching : sortCards(matching, sort, e => ({
    name: e.record.summary.name, price: e.candidate.price, collectorNumber: e.candidate.printing.collectorNumber,
    color: e.category, setCode: e.candidate.printing.setCode,
  }), connector.sortOrder);

  const totalHere = current.cards.reduce((n, c) => n + (cards.parts.get(c.key)?.copies ?? 0), 0);
  const foundHere = current.cards.reduce((n, c) => { const p = cards.parts.get(c.key); return n + (p ? foundCopies(trip, p) : 0); }, 0);
  const leftHere = totalHere - foundHere;

  return (
    <>
      {header}
      <div className={screen.stack}>
        {loading && <Banner tone="info" title={t.loading(data.progress.done, data.progress.total)} />}

        <div className={styles.picker}>
          <Button variant="icon" aria-label={t.previous} disabled={index <= 0} onClick={() => go(stops[index - 1]?.stop.id)}>‹</Button>
          <Select label={t.pickerHint(true)} value={current.stop.id} onChange={e => pick(e.target.value)}>
            {stops.map((s, i) => (
              <option key={s.stop.id} value={s.stop.id}>{t.option(i + 1, s.stop.label, s.copies, pullVerdict(s, store.settings.pull) === 'buy_online')}</option>
            ))}
            {finished.length > 0 && (
              <optgroup label={t.finishedGroup}>
                {finished.map(id => <option key={id} value={`finished:${id}`}>{t.finishedOption(stopLabel(plan, id) ?? id)}</option>)}
              </optgroup>
            )}
          </Select>
          <Button variant="icon" aria-label={t.next} disabled={index >= stops.length - 1} onClick={() => go(stops[index + 1]?.stop.id)}>›</Button>
        </div>

        <div className={styles.kickerRow}>
          <p className={styles.kicker}>{t.stopOf(index + 1, stops.length)}</p>
          {!flip && <PullVerdict verdict={verdict} />}
        </div>
        {!flip && (
          <>
            <h2 className={styles.stopTitle}>{current.stop.label}</h2>
            <p className={styles.note}>{t.counter.lead(current.stop.kind as 'display_case' | 'ask_associate' | 'value_binder')}</p>
          </>
        )}

        {flip ? (
          <>
            <div className={styles.progress}>
              <ProgressBar value={foundHere} max={totalHere} label={t.progressLabel} />
              <span className={styles.note}>{t.foundProgress(foundHere, totalHere)}</span>
            </div>

            <div className={styles.chips} role="group" aria-label={t.listsLabel}>
              {listsWithCards.map(list => {
                const on = trip.listIds.includes(list.id);
                const count = list.entries.filter(e => e.status === 'needed').length;
                return <Chip key={list.id} pressed={on} onPress={() => update(tr => setListOn(tr, list.id, !on, order))}>{t.listChip(list.name, count)}</Chip>;
              })}
              <Button variant="secondary" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}>{t.sortAndFilter}</Button>
            </div>

            {showFilters && (
              <div className={styles.filters}>
                <div className={styles.filterRow}>
                  <Select label={t.sort.label} value={sort} onChange={e => setSort(e.target.value as DiveSort)}>
                    <option value="binder">{t.sort.binder}</option>
                    {SORT_MODES.map(mode => <option key={mode} value={mode}>{copy.review.sort[mode]}</option>)}
                  </Select>
                  <Select label={copy.filters.price.label} value={price} onChange={e => setPrice(e.target.value as PriceFilter)}>
                    {PRICE_FILTERS.map(band => <option key={band} value={band}>{copy.filters.price[band]}</option>)}
                  </Select>
                </div>
                <ColorFilter selected={colors} onToggle={c => setColors(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]))} />
              </div>
            )}

            {shown.length === 0 ? <p className={styles.note}>{t.noMatches}</p> : (
              <ul className={`${styles.grid} ${layout === 'desktop' ? styles.gridWide : ''}`}>
                {shown.map(e => (
                  <CardTile
                    key={e.key}
                    name={e.record.summary.name}
                    setLabel={`${e.candidate.printing.setCode.toUpperCase()} ${e.candidate.printing.collectorNumber}`}
                    price={formatUsd(e.candidate.price)}
                    lists={e.part.parts.map(p => p.listName).join(', ')}
                    imageUrl={e.record.summary.imageSmall}
                    edge={e.edge}
                    quantity={e.part.copies}
                    found={foundCopies(trip, e.part)}
                    onFound={() => update(tr => markFound(tr, e.part))}
                    onUndo={() => update(tr => undoFound(tr, e.part))}
                  />
                ))}
              </ul>
            )}

            <SummaryBar
              sticky={phone}
              label={t.finishBinder}
              title={leftHere > 0 ? t.cardsLeft(leftHere) : t.nothingLeft}
              action={<Button size="lg" onClick={() => finish(current, t.finishedToast)}>{t.finishBinder}</Button>}
            />
          </>
        ) : (
          <CounterStop
            stop={current}
            trip={trip}
            parts={cards.parts}
            records={data.records}
            categoryOf={categoryOf}
            onFound={part => update(tr => markAllFound(tr, part))}
            onUndo={part => update(tr => undoAllFound(tr, part))}
            onNotAvailable={key => update(tr => markNotAvailable(tr, key))}
            onDone={() => finish(current, copy.storeDive.counter.doneToast)}
          />
        )}
      </div>
      {endDialog}
    </>
  );
}
