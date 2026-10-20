// Card detail from a list: the picture, how many copies and the status on this list, where to look first, the other
// places to try and every printing. Opens from the list review; previous and next walk the cards shown there.
import type { CardRecord } from '../../../core/cards';
import type { CardList } from '../../../core/lists';
import { bannerCardName } from '../../../core/lists';
import type { CardStatus } from '../../../core/status';
import { Button, StatusPicker, Stepper, useToast } from '../../components';
import { copy } from '../../copy/en';
import { useLists } from '../../data/ListsProvider';
import { joinNames } from '../../format';
import { CardDetailShell } from './CardDetailShell';
import { useDetailModel } from './model';
import { AlsoTry, BuyButton, FirstPlace, Heading, Picture, Printings, subtitleFor } from './Sections';
import { VersionPicker } from './VersionPicker';
import styles from './CardDetail.module.css';

const t = copy.cardDetail;
const MAX_COPIES = 99;

interface ListCardDetailProps {
  list: CardList;
  cardKey: string;
  keys: readonly string[];                 // the cards to walk through, in the order shown
  records: ReadonlyMap<string, CardRecord>;
  onOpen: (cardKey: string) => void;
  onClose: () => void;
}

export function ListCardDetail({ list, cardKey, keys, records, onOpen, onClose }: ListCardDetailProps) {
  const lists = useLists();
  const toast = useToast();
  const entry = list.entries.find(e => e.cardKey === cardKey);
  const lock = entry?.locked && entry.print ? entry.print : undefined;
  const model = useDetailModel(records.get(cardKey), undefined, lock);
  if (!entry) return null;

  const at = keys.indexOf(cardKey);
  const go = (to: number) => (to >= 0 && to < keys.length ? () => onOpen(keys[to]) : undefined);
  const others = lists.lists.filter(l => l.entries.some(e => e.cardKey === cardKey));

  const changeStatus = async (status: CardStatus) => {
    const previous = entry.status;
    await lists.setStatus(list.id, cardKey, status);
    toast.show({ message: copy.statusPicker.changed(entry.name, copy.status[status]), onAction: () => { void lists.setStatus(list.id, cardKey, previous); } });
  };
  const changeQuantity = async (quantity: number) => {
    const previous = entry.quantity;
    await lists.setQuantity(list.id, cardKey, quantity);
    toast.show({ message: t.quantityChanged(entry.name, quantity), onAction: () => { void lists.setQuantity(list.id, cardKey, previous); } });
  };
  const paper = (records.get(cardKey)?.printings ?? []).filter(p => !p.digital && p.games.includes('paper'));
  const isBanner = bannerCardName(list) === entry.name;
  const makeBanner = async () => {
    const previous = list.banner ?? null;
    await lists.setBanner(list.id, entry.name);
    toast.show({ message: t.banner.set(entry.name), onAction: () => { void lists.setBanner(list.id, previous); } });
  };
  const remove = async () => {
    const result = await lists.removeCards(list.id, [cardKey]);
    onClose();
    if (result && result.removed > 0) toast.show({ message: t.removed(entry.name, list.name), onAction: () => { void lists.restoreList(result.previous); } });
  };

  return (
    <CardDetailShell
      position={at >= 0 ? t.position(at + 1, keys.length) : ''}
      onClose={onClose}
      onPrevious={at >= 0 ? go(at - 1) : undefined}
      onNext={at >= 0 ? go(at + 1) : undefined}
      footer={<><Button variant="secondary" onClick={() => { void remove(); }}>{t.removeFromList}</Button><BuyButton name={model?.name ?? entry.name} /></>}
    >
      {titleId => (
        <>
          <Picture name={entry.name} model={model} />
          <Heading id={titleId} name={model?.name ?? entry.name} subtitle={subtitleFor(model)} />
          <div className={styles.controls}>
            <span className={styles.control}>
              {t.need}
              <Stepper label={t.quantityLabel(entry.name)} value={entry.quantity} min={1} max={MAX_COPIES} onChange={q => { void changeQuantity(q); }} />
            </span>
            <span className={styles.control}>
              {t.status}
              <StatusPicker cardName={entry.name} status={entry.status} onChange={status => changeStatus(status)} />
            </span>
          </div>
          {paper.length > 0 && <VersionPicker entry={entry} printings={paper} onChange={version => { void lists.setVersion(list.id, cardKey, version); }} />}
          {list.kind === 'deck' && (
            <p className={styles.note}>
              {isBanner ? t.banner.is : <Button variant="text" onClick={() => { void makeBanner(); }}>{t.banner.use}</Button>}
            </p>
          )}
          <p className={styles.note}>
            {t.onLists}{' '}
            <strong className={styles.strong}>
              {joinNames(others.map(l => t.listWithCopies(l.name, l.entries.find(e => e.cardKey === cardKey)?.quantity ?? 1)))}
            </strong>
          </p>
          {model && (
            <>
              <FirstPlace model={model} kicker={t.lookFirst} />
              <AlsoTry model={model} title={t.alsoTry} />
              <Printings model={model} />
            </>
          )}
        </>
      )}
    </CardDetailShell>
  );
}
