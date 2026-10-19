// The parts of card detail the list review and the store share: the picture, the title, where to look and the printings.
// Places are shown in the engine's order and nothing else: no odds, no chances.
import type { Place } from '../../../core/cardDetail';
import type { Finish } from '../../../core/engine/engine';
import { Button, ListRow, Rank } from '../../components';
import { CardImage } from '../../components/CardImage';
import { copy } from '../../copy/en';
import { cx } from '../../cx';
import { formatUsd } from '../../format';
import { isOn } from '../../flags';
import { buyUrl } from '../../links';
import { cardSearchUrl } from '../../../core/buy';
import { useLayout } from '../../layout/useLayout';
import type { DetailModel } from './model';
import styles from './CardDetail.module.css';

const t = copy.cardDetail;

const setLabel = (setCode: string, number: string) => `${setCode.toUpperCase()} ${number}`;
const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const finishNote = (finish: Finish): string | null => (finish === 'nonfoil' ? null : t.finish[finish].toLowerCase());

// Opens the card's TCGplayer search in a new tab, through the affiliate address once there is one.
export function BuyButton({ name }: { name: string }) {
  return (
    <span className={styles.buy}>
      <Button variant="secondary" aria-label={t.buyLabel(name)} onClick={() => { window.open(buyUrl(cardSearchUrl(name)), '_blank', 'noopener,noreferrer'); }}>{t.buy}</Button>
      {isOn('affiliateLinks') && <span className={styles.note}>{copy.affiliate.note}</span>}
    </span>
  );
}

export function Picture({ name, model }: { name: string; model: DetailModel | null }) {
  const wide = useLayout() !== 'phone';
  return (
    <div className={styles.picture}>
      <div className={cx(styles.pictureBox, wide && styles.pictureBoxWide)}>
        <CardImage name={name} src={model?.imageUrl ?? null} fallback={model?.imageFallback} edge={model?.edge ?? 'Colorless'} fluid />
      </div>
    </div>
  );
}

export function Heading({ id, name, subtitle }: { id: string; name: string; subtitle: string }) {
  return (
    <div>
      <h2 id={id} className={styles.heading}>{name}</h2>
      <p className={styles.sub}>{subtitle}</p>
    </div>
  );
}

export function subtitleFor(model: DetailModel | null): string {
  return model ? t.subtitle(model.typeLine, model.typical === null ? null : formatUsd(model.typical)) : t.loading;
}

// "Look here first" (or "In this binder" in the store): the printing and place the plan has for this card.
export function FirstPlace({ model, kicker }: { model: DetailModel; kicker: string }) {
  const places = model.places;
  if (places.status === 'skipped_basic') return <p className={styles.note}>{t.skippedBasic}</p>;
  if (places.status === 'no_stop') return <p className={styles.note}>{t.noBinder}</p>;
  const { stop, printing, finish, price } = places.first;
  return (
    <div className={styles.first}>
      <span className={styles.kicker}>{kicker}</span>
      <strong className={styles.firstName}>{stop.label}</strong>
      <span className={styles.firstMeta}>{t.placeMeta(setLabel(printing.setCode, printing.collectorNumber), printing.rarity, formatUsd(price), finishNote(finish))}</span>
    </div>
  );
}

function hintOf(place: Place): string | null {
  return place.hint ? copy.storeDive.counter.hint[place.hint] : null;
}

// The other places to try, in the engine's order. The numbers say the order only.
export function AlsoTry({ model, title }: { model: DetailModel; title: string }) {
  if (model.places.status !== 'routed') return null;
  const others = model.places.others;
  return (
    <section aria-labelledby="also-try">
      <h3 id="also-try" className={styles.sectionTitle}>{title}</h3>
      {others.length === 0 ? <p className={styles.note}>{t.noOthers}</p> : (
        <ol className={styles.plain}>
          {others.map((place, i) => (
            <ListRow
              key={place.stop.id}
              lead={<Rank n={i + 2} />}
              title={place.stop.label}
              subtitle={t.placeSub(place.printing.setName, setLabel(place.printing.setCode, place.printing.collectorNumber), place.printing.rarity, hintOf(place))}
              trailing={formatUsd(place.price)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

// Every paper printing: set, number, rarity and the price of each finish.
export function Printings({ model }: { model: DetailModel }) {
  const rows = model.printings;
  return (
    <details className={styles.details}>
      <summary>{t.printings(rows.length)}</summary>
      {rows.length === 0 ? <p className={styles.note}>{t.noPrintings}</p> : (
        <table className={styles.table}>
          <caption className={styles.srOnly}>{t.printingsLabel}</caption>
          <thead>
            <tr>
              <th scope="col">{t.columns.set}</th>
              <th scope="col">{t.columns.rarity}</th>
              <th scope="col" className={styles.number}>{t.columns.price}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                <td>
                  <span className={styles.setName}>{row.setName}</span>
                  <span className={styles.muted}>{setLabel(row.setCode, row.collectorNumber)}</span>
                  {row.planned && <span className={styles.tag}>{t.printingPlanned}</span>}
                  {!row.carried && <span className={styles.muted}>{t.printingNotCarried}</span>}
                </td>
                <td>{capitalize(row.rarity)}</td>
                <td className={styles.number}>
                  {row.prices.map(p => (
                    <span key={p.finish} className={styles.muted}>
                      {row.prices.length > 1 ? `${t.finish[p.finish]} ${formatUsd(p.price)}` : formatUsd(p.price)}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
