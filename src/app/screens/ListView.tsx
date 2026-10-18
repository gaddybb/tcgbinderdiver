// A plain stand-in for the list view (a later step), so Open on My lists leads to the list's cards.
import { QuantityBadge, ListRow, PageHeader, SkeletonRow, StandaloneLink, StatusLabel } from '../components';
import { copy } from '../copy/en';
import { useLists } from '../data/ListsProvider';
import { listCounts } from '../../core/lists';
import styles from './Screen.module.css';

const t = copy.listView;

export function ListView({ params }: { params: Record<string, string> }) {
  const lists = useLists();
  if (!lists.ready) return <SkeletonRow />;

  const list = lists.lists.find(l => l.id === params.id);
  if (!list) {
    return (
      <>
        <PageHeader title={t.notFoundTitle} />
        <StandaloneLink to="/lists">{t.back}</StandaloneLink>
      </>
    );
  }

  const counts = listCounts(list);
  return (
    <>
      <PageHeader title={list.name} subtitle={t.counts(counts.needed, counts.cards)} />
      <div className={styles.stack}>
        <StandaloneLink to="/lists">{t.back}</StandaloneLink>
        {list.entries.length === 0 ? <p className={styles.lead}>{t.emptyList}</p> : (
          <ul className={styles.plain}>
            {list.entries.map(e => (
              <ListRow
                key={e.cardKey}
                title={e.name}
                subtitle={e.tags.length > 0 ? e.tags.join(' · ') : undefined}
                trailing={<>{e.quantity > 1 && <QuantityBadge quantity={e.quantity} />} <StatusLabel status={e.status} /></>}
              />
            ))}
          </ul>
        )}
        <p className={styles.lead}>{t.comingSoon}</p>
      </div>
    </>
  );
}
