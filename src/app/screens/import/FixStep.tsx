import { useEffect, useState } from 'react';
import type { CardSummary, GameConnector } from '../../../core/connector';
import { chooseCard, pickCandidate, removeLine, resolutionCounts, undoFix } from '../../../core/import';
import type { ImportLine } from '../../../core/import';
import { Button, Input, Radio } from '../../components';
import { copy } from '../../copy/en';
import { useLayout } from '../../layout/useLayout';
import styles from './Import.module.css';

const t = copy.importFlow.fix;
const MIN_QUERY = 2;

interface FixStepProps {
  lines: readonly ImportLine[];
  onChange: (lines: ImportLine[]) => void;
  connector: GameConnector;
  canContinue: boolean;
  onBack: () => void;
  onContinue: () => void;
}

export function FixStep({ lines, onChange, connector, canContinue, onBack, onContinue }: FixStepProps) {
  const phone = useLayout() === 'phone';
  const counts = resolutionCounts(lines);
  const picks = lines.filter(l => l.candidates);
  const missing = lines.filter(l => l.state === 'missing' || (l.state === 'chosen' && !l.candidates));
  const fixed = lines.filter(l => l.state === 'fixed');
  const [page, setPage] = useState(0);
  const at = Math.min(page, Math.max(picks.length - 1, 0));
  const shownPicks = phone ? picks.slice(at, at + 1) : picks;
  const help = counts.pick + counts.missing;

  return (
    <div className={styles.flow}>
      <section className={styles.group}>
        <h2 className={styles.heading}>{t.title}</h2>
        <p className={styles.lead}>{t.summary(counts.exact, counts.fixed, help)}</p>
      </section>

      {picks.length > 0 && (
        <section className={styles.group} aria-label={t.pick.title(picks.length)}>
          <h3 className={styles.subheading}>{t.pick.title(picks.length)}</h3>
          <p className={styles.note}>{t.pick.lead}</p>
          {shownPicks.map(line => (
            <fieldset key={line.key} className={styles.panel}>
              <legend className={styles.subheading}>{t.pick.heading(line.requested, line.candidates?.length ?? 0)}</legend>
              <div className={styles.choices}>
                {line.candidates?.map(candidate => (
                  <Radio
                    key={candidate.id}
                    name={`pick-${line.key}`}
                    label={`${candidate.name} · ${candidate.typeLine}`}
                    checked={line.card?.id === candidate.id}
                    onChange={() => onChange(pickCandidate(lines, line.key, candidate.id))}
                  />
                ))}
              </div>
            </fieldset>
          ))}
          {phone && picks.length > 1 && (
            <div className={styles.pager}>
              <Button variant="secondary" disabled={at === 0} onClick={() => setPage(at - 1)}>{t.pick.previous}</Button>
              <span>{t.pick.pager(at + 1, picks.length)}</span>
              <Button variant="secondary" disabled={at >= picks.length - 1} onClick={() => setPage(at + 1)}>{t.pick.next}</Button>
            </div>
          )}
        </section>
      )}

      {missing.length > 0 && (
        <section className={styles.group} aria-label={t.missing.title(missing.length)}>
          <h3 className={styles.subheading}>{t.missing.title(missing.length)}</h3>
          <ul className={styles.list}>
            {missing.map(line => (
              <li key={line.key} className={styles.panel}>
                {line.state === 'chosen' && line.card ? (
                  <div className={styles.row}>
                    <span className={styles.rowName}>{t.missing.using(line.card.name)}</span>
                    <Button variant="text" onClick={() => onChange(undoFix(lines, line.key))}>{t.missing.undo}</Button>
                  </div>
                ) : (
                  <NotFoundRow
                    line={line}
                    connector={connector}
                    onChoose={card => onChange(chooseCard(lines, line.key, card))}
                    onRemove={() => onChange(removeLine(lines, line.key))}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {fixed.length > 0 && (
        <section className={styles.group} aria-label={t.fixed.title(fixed.length)}>
          <h3 className={styles.subheading}>{t.fixed.title(fixed.length)}</h3>
          <p className={styles.note}>{t.fixed.lead}</p>
          <ul className={styles.list}>
            {fixed.map(line => (
              <li key={line.key} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{line.card?.name}</span>
                  <span className={styles.rowSub}>{t.fixed.typed(line.requested)}</span>
                </span>
                <Button variant="text" aria-label={t.fixed.undoLabel(line.card?.name ?? line.requested)} onClick={() => onChange(undoFix(lines, line.key))}>
                  {t.fixed.undo}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>{copy.importFlow.back}</Button>
        <span className={styles.actionsEnd}>
          <span className={styles.note}>{t.skipNote}</span>
          <Button disabled={!canContinue} onClick={onContinue}>{t.continue}</Button>
        </span>
      </div>
    </div>
  );
}

interface NotFoundRowProps {
  line: ImportLine;
  connector: GameConnector;
  onChoose: (card: CardSummary) => void;
  onRemove: () => void;
}

// A name nothing matched: the player types, picks a suggestion, or drops it.
function NotFoundRow({ line, connector, onChoose, onRemove }: NotFoundRowProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ query: string; names: string[] }>({ query: '', names: [] });

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_QUERY) return;
    const controller = new AbortController();
    connector.autocomplete(text, controller.signal).then(
      names => { if (!controller.signal.aborted) setSuggestions({ query: text, names }); },
      () => { /* no suggestions this time; the player can keep typing */ },
    );
    return () => controller.abort();
  }, [query, connector]);

  const names = query.trim() === suggestions.query ? suggestions.names : [];

  const choose = async (name: string) => {
    const { found } = await connector.lookupNames([name]);
    if (found[0]) onChoose(found[0].card);
  };

  return (
    <div className={styles.group}>
      <p className={styles.note}>{t.missing.typed(line.requested)}</p>
      <Input label={t.missing.inputLabel} value={query} onChange={e => setQuery(e.target.value)} />
      {names.length > 0 && (
        <ul className={styles.suggestions} aria-label={t.missing.suggestions(line.requested)}>
          {names.map(name => (
            <li key={name}><Button variant="text" onClick={() => { void choose(name); }}>{name}</Button></li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="text" onClick={onRemove}>{t.missing.remove}</Button>
      </div>
    </div>
  );
}
