import { useMemo, useState } from 'react';
import { bannerImageUrl, findPrinting, printingImageUrl, typicalOnline } from '../../core/cards';
import type { CardRecord } from '../../core/cards';
import type { Printing } from '../../core/engine/engine';
import { PRICE_FILTERS, filterCards } from '../../core/filter';
import type { PriceFilter } from '../../core/filter';
import { MAX_CARDS_PER_LIST, bannerCardName, binderCounts, cardKeysInBinder, listCounts } from '../../core/lists';
import type { CardList, ListEntry } from '../../core/lists';
import { planLists } from '../../core/plan';
import type { CardTarget } from '../../core/plan';
import { SORT_MODES, sortCards } from '../../core/sort';
import type { SortMode } from '../../core/sort';
import { CARD_STATUSES } from '../../core/status';
import type { CardStatus } from '../../core/status';
import {
  Banner, Button, CardTable, CardThumb, ColorFilter, DeckBanner, HoverPreview, Input, ListRow, Menu, PageHeader, QuantityBadge, Select, SelectHeader, SelectionBar, SkeletonRow,
  StandaloneLink, StatusLabel, StatusPicker, isColorCategory, useToast,
} from '../components';
import type { ColorCategory } from '../components';
import { copy } from '../copy/en';
import { useCardData, useCatalogInfo, useConnector } from '../data/CardDataProvider';
import { useLists } from '../data/ListsProvider';
import { useStoreSettings } from '../data/StoreSettingsProvider';
import { formatDate, formatUsd } from '../format';
import { useLayout } from '../layout/useLayout';
import { printingLabel } from '../printingLabel';
import { Link, navigate } from '../router';
import { ListCardDetail } from './detail/ListCardDetail';
import { DivePanel } from './dive/DivePanel';
import { Tour } from './tour/Tour';
import { neededCards } from './dive/planData';
import review from './Review.module.css';
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
  printing: Printing | undefined;   // the print the target binder is predicted to hold: its picture and label go on the row
  targetText: string;
  setLabel: string;
  price: number | null;
}

function ReviewBody({ list }: { list: CardList }) {
  const lists = useLists();
  const toast = useToast();
  const connector = useConnector();
  const layout = useLayout();
  const phone = layout === 'phone';
  const sideBySide = layout === 'desktop';   // the dive plan sits beside the cards only where there is room; else it sits above them

  const [sort, setSort] = useState<SortMode>('status');
  const [query, setQuery] = useState('');
  const [price, setPrice] = useState<PriceFilter>('any');
  const [colors, setColors] = useState<ColorCategory[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [selecting, setSelecting] = useState(false);     // phone only: the table always has checkboxes
  const [openKey, setOpenKey] = useState<string | null>(null);   // the card shown in card detail

  // This list's cards, plus the cards other lists in the next dive still need, so the dive plan beside it has its data too.
  const cards = useMemo(() => {
    const byKey = new Map(list.entries.map(e => [e.cardKey, { cardKey: e.cardKey, name: e.name }]));
    for (const c of neededCards(lists.lists.filter(l => l.inNextDive))) if (!byKey.has(c.cardKey)) byKey.set(c.cardKey, c);
    return [...byKey.values()];
  }, [list.entries, lists.lists]);
  const data = useCardData(cards, lists.now);
  const catalog = useCatalogInfo();
  const store = useStoreSettings();

  // Where each card is planned to be found, for this list on its own. (The combined plan across lists comes with the dive plan.)
  const { targets } = useMemo(
    () => planLists([{ ...list, inNextDive: true }], data.records, store.profile, lists.now()),
    [list, data.records, store.profile, lists],
  );

  const rows: Row[] = list.entries.map(entry => {
    const record = data.records.get(entry.cardKey);
    const target = entry.status === 'needed' ? targets.get(entry.cardKey) : undefined;
    const category = record ? connector.sortCategory(record.summary) : 'Colorless';
    let targetText: string = copy.review.target.none;
    if (data.notFound.has(entry.cardKey)) targetText = t.target.notFound;
    else if (entry.status !== 'needed') targetText = t.target.nothing;
    else if (target?.kind === 'stop') targetText = target.stopLabel;
    else if (target?.kind === 'no_binder') targetText = t.target.noBinder;
    else if (target?.kind === 'skipped_basic') targetText = t.target.basicLand;
    const printing = record && target?.kind === 'stop' ? findPrinting(record.printings, target.setCode, target.collectorNumber) : undefined;
    return {
      entry,
      record,
      edge: isColorCategory(category) ? category : 'Colorless',
      target,
      printing,
      targetText,
      setLabel: printing ? printingLabel(printing) : target?.kind === 'stop' ? `${target.setCode.toUpperCase()} ${target.collectorNumber}` : t.target.none,
      // The price of the print the row names, so the set, the picture and the price all describe one print; the card's typical price only when no print is named.
      price: target?.kind === 'stop' && target.price !== null ? target.price : record ? typicalOnline(record.printings) : null,
    };
  });

  const matching = filterCards(rows, { query, price, colors }, r => ({ name: r.entry.name, price: r.price, color: r.edge }));
  const shown = sortCards(matching, sort, r => ({
    name: r.entry.name,
    price: r.price,
    collectorNumber: r.target?.kind === 'stop' ? r.target.collectorNumber : null,
    color: r.edge,
    setCode: r.target?.kind === 'stop' ? r.target.setCode : null,
    status: r.entry.status,
  }), connector.sortOrder);

  const unknown = list.entries.filter(e => data.notFound.has(e.cardKey));
  const counts = listCounts(list);
  const accounted = CARD_STATUSES.filter(s => s !== 'needed')
    .map(s => ({ s, n: list.entries.filter(e => e.status === s).length }))
    .filter(x => x.n > 0)
    .map(x => `${x.n} ${copy.status[x.s].toLowerCase()}`)
    .join(', ');
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
  const thumb = (row: Row) => (
    <HoverPreview src={row.printing ? printingImageUrl(row.printing) : row.record?.summary.imageNormal ?? null}>
      <CardThumb edge={row.edge} src={row.printing ? printingImageUrl(row.printing, 'small') : row.record?.summary.imageSmall} fallback={row.record?.summary.imageSmall} />
    </HoverPreview>
  );

  const bannerName = bannerCardName(list);

  return (
    <>
      {list.entries.length > 0 && <Tour id="list" />}
      <DeckBanner size="page" src={bannerName ? bannerImageUrl(bannerName) : null} />
      <PageHeader
        title={list.name}
        subtitle={phone ? t.summaryPhone(counts.needed, online) : t.summary(counts.cards, counts.needed, online)}
        actions={
          <span className={review.headerActions}>
            <Button variant="text" onClick={data.refresh}>{t.refresh}</Button>
            <Button variant="secondary" onClick={() => navigate('/import')}>{t.pasteAnother}</Button>
          </span>
        }
      />

      <div className={styles.stack}>
        <nav aria-label={t.tabsLabel} className={review.tabs}>
          <Link to="/lists" className={review.all}>{copy.listView.back}</Link>
          {lists.lists.map(l => (
            <Link key={l.id} to={`/lists/${l.id}`} className={review.tab} aria-current={l.id === list.id ? 'page' : undefined}>{l.name}</Link>
          ))}
        </nav>

        <div className={sideBySide ? review.layoutWide : review.layout}>
        {!sideBySide && <DivePanel compact records={data.records} />}
        <div className={review.main}>
        {data.status === 'loading' && data.progress.total > 0 && (
          <Banner tone="info" title={t.loading.title(list.name)}>{t.loading.detail(data.progress.done, data.progress.total)}</Banner>
        )}
        {data.status === 'error' && (
          <Banner tone="error" title={t.error.title} actions={<Button variant="secondary" onClick={data.retry}>{t.error.retry}</Button>}>
            {t.error.detail}
          </Banner>
        )}
        {counts.cards > 0 && counts.needed === 0 && (
          <Banner tone="info" title={copy.allAccounted.title} actions={<Button variant="secondary" onClick={() => navigate('/import')}>{t.pasteAnother}</Button>}>
            {copy.allAccounted.detail(counts.cards, accounted)}
          </Banner>
        )}
        {unknown.length > 0 && (
          <Banner tone="warning" title={t.notFoundBanner.title(unknown.length)}>
            {t.notFoundBanner.detail(unknown.map(e => e.name).join(', '))}
          </Banner>
        )}

        {list.entries.length === 0 ? <p className={styles.lead}>{copy.listView.emptyList}</p> : (
          <>
            <div className={styles.controls} data-tour="list-controls">
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

            <div data-tour="list-cards">
            {shown.length === 0 ? <p className={styles.lead}>{f.noMatches}</p> : phone ? (
              <ul className={styles.plain}>
                {shown.map(row => (
                  <ListRow
                    key={row.entry.cardKey}
                    select={selecting ? { checked: selected.has(row.entry.cardKey), label: b.selectCard(row.entry.name), onChange: () => toggle(row.entry.cardKey) } : undefined}
                    onLongPress={() => startSelecting(row.entry.cardKey)}
                    onOpen={selecting ? undefined : () => setOpenKey(row.entry.cardKey)}
                    openLabel={copy.cardTile.openCard(row.entry.name)}
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
                  onOpen: () => setOpenKey(row.entry.cardKey),
                }))}
              />
            )}
            </div>
            {catalog && <p className={styles.lead}>{t.pricesUpdated(formatDate(catalog.scryfallUpdatedAt))}{catalog.offline && ` ${t.pricesOffline}`}</p>}
            {openKey && <ListCardDetail list={list} cardKey={openKey} keys={shownKeys} records={data.records} onOpen={setOpenKey} onClose={() => setOpenKey(null)} />}
            {phone && selecting && <SelectionBar placement="bottom" ariaLabel={b.selectedCards(picked.length)} label={b.selectedCards(picked.length)} actions={actions} />}
          </>
        )}
        </div>
        {sideBySide && <DivePanel compact={false} records={data.records} />}
        </div>
      </div>
    </>
  );
}
