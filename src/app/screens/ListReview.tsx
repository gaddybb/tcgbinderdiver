import { useMemo, useState } from 'react';
import { typicalOnline } from '../../core/cards';
import type { CardRecord } from '../../core/cards';
import { V1_STORE } from '../../core/engine/engine';
import { listCounts } from '../../core/lists';
import type { CardList, ListEntry } from '../../core/lists';
import { nameKey } from '../../core/parse/parseDecklist';
import { planLists } from '../../core/plan';
import type { CardTarget } from '../../core/plan';
import { SORT_MODES, sortCards } from '../../core/sort';
import type { SortMode } from '../../core/sort';
import type { CardStatus } from '../../core/status';
import {
  Banner, Button, CardTable, CardThumb, Input, ListRow, PageHeader, QuantityBadge, Select, SkeletonRow, StandaloneLink, StatusPicker, isColorCategory,
  useToast,
} from '../components';
import type { ColorCategory } from '../components';
import { copy } from '../copy/en';
import { useCardData, useConnector } from '../data/CardDataProvider';
import { useLists } from '../data/ListsProvider';
import { formatUsd } from '../format';
import { useLayout } from '../layout/useLayout';
import styles from './Screen.module.css';

const t = copy.review;

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

  const needle = nameKey(query.trim());
  const matching = needle ? rows.filter(r => nameKey(r.entry.name).includes(needle)) : rows;
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
            </div>

            {shown.length === 0 ? <p className={styles.lead}>{t.noMatches}</p> : phone ? (
              <ul className={styles.plain}>
                {shown.map(row => (
                  <ListRow
                    key={row.entry.cardKey}
                    lead={thumb(row)}
                    title={<>{row.entry.name}{row.entry.quantity > 1 && <> <QuantityBadge quantity={row.entry.quantity} /></>}</>}
                    subtitle={row.setLabel === t.target.none ? row.targetText : `${row.targetText} · ${row.setLabel}`}
                    trailing={<div className={styles.rowEnd}><span>{formatUsd(row.price)}</span>{picker(row)}</div>}
                  />
                ))}
              </ul>
            ) : (
              <CardTable
                labels={{ table: t.tableLabel(list.name), ...t.columns }}
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
          </>
        )}
      </div>
    </>
  );
}
