import { useMemo, useState } from 'react';
import { typicalOnline } from '../../core/cards';
import type { CardRecord } from '../../core/cards';
import { V1_STORE } from '../../core/engine/engine';
import { PRICE_FILTERS, filterCards } from '../../core/filter';
import type { PriceFilter } from '../../core/filter';
import { MAX_CARDS_PER_LIST, binderCounts, cardKeysInBinder, listCounts } from '../../core/lists';
import type { CardList, ListEntry } from '../../core/lists';
import { planLists } from '../../core/plan';
import type { CardTarget } from '../../core/plan';
import { SORT_MODES, sortCards } from '../../core/sort';
import type { SortMode } from '../../core/sort';
import { CARD_STATUSES } from '../../core/status';
import type { CardStatus } from '../../core/status';
import {
  Banner, Button, CardTable, CardThumb, ColorFilter, Input, ListRow, Menu, PageHeader, QuantityBadge, Select, SelectHeader, SelectionBar, SkeletonRow,
  StandaloneLink, StatusLabel, StatusPicker, isColorCategory, useToast,
} from '../components';
import type { ColorCategory } from '../components';
import { copy } from '../copy/en';
import { useCardData, useConnector } from '../data/CardDataProvider';
import { useLists } from '../data/ListsProvider';
import { formatUsd } from '../format';
import { useLayout } from '../layout/useLayout';
import styles from './Screen.module.css';

const t = copy.review;
const b = copy.bulk;
const f = copy.filters;

export function ListReview({ params }: { params: Record<string, string> }) {
  const lists = useLists();
  if (!lists.ready) return <SkeletonRow />;
  const list = lists.lists.find(l => l.id === params.id);
  if (!list) {
    return (
      <>
        <PageHeader title={copy.listView.notFoundTitle} />
        <StandaloneLink to="/lists">{copy.listView.back}</StandaloneLink>
      </>
    );
  }
  return <ReviewBody key={list.id} list={list} />;
}

interface Row {
  entry: ListEntry;
  record: CardRecord | undefined;
  edge: ColorCategory;
  target: CardTarget | undefined;
  targetText: string;
  setLabel: string;
  price: number | null;
}

function ReviewBody({ list }: { list: CardList }) {
  const lists = useLists();
  const toast = useToast();
  const connector = useConnector();
  const phone = useLayout() === 'phone';

  const [sort, setSort] = useState<SortMode>('alphabetical');
  const [query, setQuery] = useState('');
  const [price, setPrice] = useState<PriceFilter>('any');
  const [colors, setColors] = useState<ColorCategory[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [selecting, setSelecting] = useState(false);     // phone only: the table always has checkboxes

  const cards = useMemo(() => list.entries.map(e => ({ cardKey: e.cardKey, name: e.name })), [list.entries]);
  const data = useCardData(cards, lists.now);

  // Where each card is planned to be found, for this list on its own. (The combined plan across lists comes with the dive plan.)
  const { targets } = useMemo(
    () => planLists([{ ...list, inNextDive: true }], data.records, V1_STORE, lists.now()),
    [list, data.records, lists],
  );

  const rows: Row[] = list.entries.map(entry => {
    const record = data.records.get(entry.cardKey);
    const target = entry.status === 'needed' ? targets.get(entry.cardKey) : undefined;
    const category = record ? connector.sortCategory(record.summary) : 'Colorless';
    let targetText: string = copy.review.target.none;
    if (data.notFound.has(entry.cardKey)) targetText = t.target.notFound;
    else if (target?.kind === 'stop') targetText = target.stopLabel;
    else if (target?.kind === 'no_binder') targetText = t.target.noBinder;
    else if (target?.kind === 'skipped_basic') targetText = t.target.basicLand;
    return {
      entry,
      record,
      edge: isColorCategory(category) ? category : 'Colorless',
      target,
      targetText,
      setLabel: target?.kind === 'stop' ? `${target.setCode.toUpperCase()} ${target.collectorNumber}` : t.target.none,
      price: record ? typicalOnline(record.printings) : null,
    };
  });

  const matching = filterCards(rows, { query, price, colors }, r => ({ name: r.entry.name, price: r.price, color: r.edge }));
  const shown = sortCards(matching, sort, r => ({
    name: r.entry.name,
    price: r.price,
    collectorNumber: r.target?.kind === 'stop' ? r.target.collectorNumber : null,
    color: r.edge,
  }), connector.sortOrder);

  const counts = listCounts(list);
  const onlineTotal = rows
    .filter(r => r.entry.status === 'needed' && r.price !== null)
    .reduce((sum, r) => sum + r.entry.quantity * (r.price ?? 0), 0);
  const online = onlineTotal > 0 ? `$${Math.round(onlineTotal)}` : null;

  const changeStatus = async (entry: ListEntry, status: CardStatus) => {
    const previous = entry.status;
    await lists.setStatus(list.id, entry.cardKey, status);
    toast.show({
      message: copy.statusPicker.changed(entry.name, copy.status[status]),
      onAction: () => { void lists.setStatus(list.id, entry.cardKey, previous); },
    });
  };

  // Selection applies to the cards shown: a card hidden by a filter is never acted on.
  const shownKeys = shown.map(r => r.entry.cardKey);
  const picked = shownKeys.filter(k => selected.has(k));
  const allPicked = shownKeys.length > 0 && picked.length === shownKeys.length;
  const toggle = (key: string) => setSelected(prev => { const next = new Set(prev); if (!next.delete(key)) next.add(key); return next; });
  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(shownKeys));
  const finish = () => { setSelected(new Set()); setSelecting(false); };
  const startSelecting = (key?: string) => { setSelecting(true); if (key) setSelected(new Set([key])); };

  const undoTo = (previous: CardList) => () => { void lists.restoreList(previous); };

  const bulkStatus = async (keys: readonly string[], status: CardStatus) => {
    const result = await lists.setStatuses(list.id, keys, status);
    finish();
    if (result && result.changed > 0) toast.show({ message: b.statusSet(result.changed, copy.status[status]), onAction: undoTo(result.previous) });
  };

  const bulkRemove = async () => {
    const result = await lists.removeCards(list.id, picked);
    finish();
    if (result && result.removed > 0) toast.show({ message: b.removed(result.removed, list.name), onAction: undoTo(result.previous) });
  };

  const bulkCopy = async (target: CardList) => {
    const result = await lists.copyCards(list.id, picked, target.id);
    finish();
    if (!result) return;
    const copied = result.added + result.merged;
    if (copied === 0) {
      if (result.notFit > 0) toast.show({ message: b.copiedNone(target.name, MAX_CARDS_PER_LIST) });
      return;
    }
    toast.show({
      message: result.notFit > 0 ? b.copiedSomeDidNotFit(copied, target.name, result.notFit, MAX_CARDS_PER_LIST) : b.copied(copied, target.name),
      onAction: undoTo(result.previous),
    });
  };

  const otherLists = lists.lists.filter(l => l.id !== list.id);
  const allKeys = list.entries.map(e => e.cardKey);
  const binderOf = new Map<string, string>();
  for (const r of shown) if (r.target?.kind === 'stop') binderOf.set(r.entry.cardKey, r.target.stopLabel);
  const binders = binderCounts(binderOf);

  const none = picked.length === 0;
  const copyLabel = phone ? b.copyToList : b.copyToAnotherList;
  const actions = (
    <>
      {none ? <Button variant="secondary" disabled>{b.setStatus}</Button> : (
        <Menu
          variant="text"
          showHints
          sheetTitle={b.setStatus}
          label={b.setStatus}
          trigger={b.setStatus}
          items={CARD_STATUSES.map(status => ({ label: copy.status[status], hint: copy.statusHint[status], onSelect: () => { void bulkStatus(picked, status); } }))}
        />
      )}
      {none || otherLists.length === 0 ? <Button variant="secondary" disabled>{copyLabel}</Button> : (
        <Menu
          variant="text"
          sheetTitle={b.copyToListTitle}
          label={copyLabel}
          trigger={copyLabel}
          items={otherLists.map(target => ({ label: target.name, onSelect: () => { void bulkCopy(target); } }))}
        />
      )}
      <Button variant="danger" disabled={none} onClick={() => { void bulkRemove(); }}>{phone ? b.remove : b.removeFromList}</Button>
      {!phone && <Button variant="text" onClick={finish}>{b.clearSelection}</Button>}
    </>
  );

  const picker = (row: Row) => (
    <StatusPicker cardName={row.entry.name} status={row.entry.status} onChange={status => changeStatus(row.entry, status)} />
  );
  const thumb = (row: Row) => <CardThumb edge={row.edge} src={row.record?.summary.imageSmall} />;

  return (
    <>
      <PageHeader
        title={list.name}
        subtitle={phone ? t.summaryPhone(counts.needed, online) : t.summary(counts.cards, counts.needed, online)}
      />

      <div className={styles.stack}>
        <StandaloneLink to="/lists">{copy.listView.back}</StandaloneLink>

        {data.status === 'loading' && data.progress.total > 0 && (
          <Banner tone="info" title={t.loading.title(list.name)}>{t.loading.detail(data.progress.done, data.progress.total)}</Banner>
        )}
        {data.status === 'error' && (
          <Banner tone="error" title={t.error.title} actions={<Button variant="secondary" onClick={data.retry}>{t.error.retry}</Button>}>
            {t.error.detail}
          </Banner>
        )}
        {data.notFound.size > 0 && (
          <Banner
            tone="warning"
            title={t.notFoundBanner.title(data.notFound.size)}
          >
            {t.notFoundBanner.detail(list.entries.filter(e => data.notFound.has(e.cardKey)).map(e => e.name).join(', '))}
          </Banner>
        )}

        {list.entries.length === 0 ? <p className={styles.lead}>{copy.listView.emptyList}</p> : (
          <>
            <div className={styles.controls}>
              <Select label={t.sort.label} value={sort} onChange={e => setSort(e.target.value as SortMode)}>
                {SORT_MODES.map(mode => <option key={mode} value={mode}>{t.sort[mode]}</option>)}
              </Select>
              <Input label={t.search.label} type="search" placeholder={t.search.placeholder} value={query} onChange={e => setQuery(e.target.value)} />
              <Select label={f.price.label} value={price} onChange={e => setPrice(e.target.value as PriceFilter)}>
                {PRICE_FILTERS.map(band => <option key={band} value={band}>{f.price[band]}</option>)}
              </Select>
              <div className={styles.filterGroup}>
                <span className={styles.controlLabel}>{f.colorLabel}</span>
                <ColorFilter selected={colors} onToggle={c => setColors(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]))} />
              </div>
            </div>

            {phone && !selecting && <Button variant="secondary" onClick={() => startSelecting()}>{b.select}</Button>}
            {phone && selecting && <SelectHeader count={picked.length} allSelected={allPicked} onClose={finish} onToggleAll={toggleAll} />}
            {phone && selecting && none && <p className={styles.lead}>{b.selectHint}</p>}
            {!phone && (
              <div className={styles.quick}>
                <span className={styles.quickLabel}>{b.quickActions}</span>
                <Button variant="secondary" onClick={() => { void bulkStatus(allKeys, 'in_collection'); }}>{b.markOwned}</Button>
                <Button variant="secondary" onClick={() => { void bulkStatus(allKeys, 'needed'); }}>{b.markNeeded}</Button>
                {binders.length > 0 ? (
                  <Menu
                    variant="text"
                    label={b.selectByBinder}
                    trigger={<>{b.selectByBinder}<span aria-hidden="true">▾</span></>}
                    items={binders.map(({ binder, cards }) => ({ label: b.binderOption(binder, cards), onSelect: () => setSelected(new Set(cardKeysInBinder(binderOf, binder))) }))}
                  />
                ) : <Button variant="secondary" disabled>{b.selectByBinder}</Button>}
              </div>
            )}
            {!phone && !none && <SelectionBar ariaLabel={b.selectedCards(picked.length)} label={b.selectedCards(picked.length)} actions={actions} />}

            {shown.length === 0 ? <p className={styles.lead}>{f.noMatches}</p> : phone ? (
              <ul className={styles.plain}>
                {shown.map(row => (
                  <ListRow
                    key={row.entry.cardKey}
                    select={selecting ? { checked: selected.has(row.entry.cardKey), label: b.selectCard(row.entry.name), onChange: () => toggle(row.entry.cardKey) } : undefined}
                    onLongPress={() => startSelecting(row.entry.cardKey)}
                    lead={thumb(row)}
                    title={<>{row.entry.name}{row.entry.quantity > 1 && <> <QuantityBadge quantity={row.entry.quantity} /></>}</>}
                    subtitle={row.setLabel === t.target.none ? row.targetText : `${row.targetText} · ${row.setLabel}`}
                    trailing={<div className={styles.rowEnd}><span>{formatUsd(row.price)}</span>{selecting ? <StatusLabel status={row.entry.status} /> : picker(row)}</div>}
                  />
                ))}
              </ul>
            ) : (
              <CardTable
                labels={{ table: t.tableLabel(list.name), ...t.columns }}
                selection={{ selected, onToggle: toggle, onToggleAll: toggleAll, rowLabel: b.selectCard, allLabel: b.selectAllCards }}
                rows={shown.map(row => ({
                  key: row.entry.cardKey,
                  thumb: thumb(row),
                  name: row.entry.name,
                  quantity: row.entry.quantity,
                  status: picker(row),
                  target: row.targetText,
                  setLabel: row.setLabel,
                  price: formatUsd(row.price),
                }))}
              />
            )}
            {phone && selecting && <SelectionBar placement="bottom" ariaLabel={b.selectedCards(picked.length)} label={b.selectedCards(picked.length)} actions={actions} />}
          </>
        )}
      </div>
    </>
  );
}
