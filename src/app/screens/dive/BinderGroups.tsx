// The binder groups editor at /groups: sets a store keeps in one binder, and sets it does not carry.
import { useMemo, useState } from 'react';
import {
  addGroup, addSetToGroup, cardsInSets, commanderSets, deleteGroup, markNotCarried, placeOfSet, removeSetFromGroup, renameGroup,
  setTypes, setsUsed, unmarkNotCarried,
} from '../../../core/store';
import type { SetUsage, StoreSettings } from '../../../core/store';
import { Banner, Button, Input, Menu, PageHeader, Select, SkeletonRow, StandaloneLink } from '../../components';
import type { MenuItem } from '../../components';
import { copy } from '../../copy/en';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import screen from '../Screen.module.css';
import styles from './Dive.module.css';
import { useDive } from './useDive';

const t = copy.groups;
const PREVIEW_ROWS = 7;

let counter = 0;
// Scryfall's own words for a set type, in plain English. A type we have no words for is made readable.
const typeLabel = (type: string): string => t.setTypes[type] ?? (type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '));

const newId = (): string => `g${Date.now().toString(36)}${(counter++).toString(36)}`;

export function BinderGroups() {
  const dive = useDive();
  const { settings, update, ready } = useStoreSettings();
  const [dismissed, setDismissed] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const usage = useMemo(() => setsUsed(dive.needed), [dive.needed]);
  const byCode = useMemo(() => new Map(usage.map(u => [u.code, u])), [usage]);
  const nameOf = (code: string) => byCode.get(code)?.name ?? code.toUpperCase();
  const unplaced = usage.filter(u => placeOfSet(settings, u.code) === null);
  const types = setTypes(unplaced);
  const filtered = typeFilter ? unplaced.filter(u => u.setType === typeFilter) : unplaced;
  const shown = showAll ? filtered : filtered.slice(0, PREVIEW_ROWS);

  const commander = commanderSets(usage);
  const commanderUnplaced = commander.filter(u => placeOfSet(settings, u.code) === null);
  const suggest = !dismissed && commanderUnplaced.length >= 2;

  const change = (fn: (s: StoreSettings) => StoreSettings) => update(fn);
  const makeGroupWith = (code: string) => change(s => addGroup(s, newId(), t.newBinderName, [code]));

  const addToItems = (u: SetUsage): MenuItem[] => [
    ...settings.binderGroups.map(g => ({ label: g.name, onSelect: () => change(s => addSetToGroup(s, g.id, u.code)) })),
    { label: t.addToNew, onSelect: () => makeGroupWith(u.code) },
    { label: t.addToNotCarried, onSelect: () => change(s => markNotCarried(s, u.code)) },
  ];

  return (
    <>
      <PageHeader title={t.title} subtitle={t.lead} />
      <div className={screen.stack}>
        <StandaloneLink to="/plan">{t.back}</StandaloneLink>

        {!ready || !dive.ready ? <SkeletonRow label={t.loading} /> : (
          <>
            {suggest && (
              <Banner
                tone="info"
                title={t.suggestion.title(commanderUnplaced.length)}
                actions={
                  <>
                    <Button variant="secondary" onClick={() => change(s => addGroup(s, newId(), t.suggestion.groupName, commanderUnplaced.map(u => u.code)))}>{t.suggestion.make}</Button>
                    <Button variant="text" onClick={() => setDismissed(true)}>{t.suggestion.dismiss}</Button>
                  </>
                }
              >
                {t.suggestion.detail}
              </Banner>
            )}

            <section className={styles.section} aria-label={t.yourGroups}>
              <div className={styles.toolbar}>
                <h2 className={styles.sectionTitle}>{t.yourGroups}</h2>
                <Button variant="secondary" onClick={() => change(s => addGroup(s, newId(), t.newBinderName))}>{t.newBinder}</Button>
              </div>
              {settings.binderGroups.length === 0 && <p className={styles.sectionDetail}>{t.noGroups}</p>}
              <ul className={styles.cards}>
                {settings.binderGroups.map(group => (
                  <GroupCard
                    key={group.id}
                    name={group.name}
                    holds={cardsInSets(dive.needed, group.setCodes)}
                    sets={group.setCodes.map(code => ({ code, name: nameOf(code) }))}
                    addable={unplaced}
                    onRename={name => change(s => renameGroup(s, group.id, name))}
                    onDelete={() => change(s => deleteGroup(s, group.id))}
                    onAdd={code => change(s => addSetToGroup(s, group.id, code))}
                    onRemove={code => change(s => removeSetFromGroup(s, group.id, code))}
                  />
                ))}
              </ul>
            </section>

            <section className={styles.groupCard} aria-label={t.notCarried.title}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{t.notCarried.title}</h2>
                <p className={styles.sectionDetail}>{t.notCarried.detail}</p>
              </div>
              {settings.notCarried.length === 0 && <p className={styles.sectionDetail}>{t.notCarried.empty}</p>}
              <ul className={screen.plain}>
                {settings.notCarried.map(code => (
                  <li key={code} className={styles.setRow}>
                    <span>{nameOf(code)}</span>
                    <Button variant="icon" aria-label={t.removeSet(nameOf(code), t.notCarried.title)} onClick={() => change(s => unmarkNotCarried(s, code))}>✕</Button>
                  </li>
                ))}
              </ul>
              <AddSet label={t.addSetLabel(t.notCarried.title)} sets={unplaced} onAdd={code => change(s => markNotCarried(s, code))} />
            </section>

            <section className={styles.section} aria-label={t.ungrouped.title(filtered.length)}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{t.ungrouped.title(unplaced.length)}</h2>
                <p className={styles.sectionDetail}>{unplaced.length === 0 ? t.ungrouped.none : t.ungrouped.detail}</p>
              </div>
              {types.length > 1 && (
                <Select label={t.ungrouped.typeLabel} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setShowAll(false); }}>
                  <option value="">{t.ungrouped.allTypes}</option>
                  {types.map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}
                </Select>
              )}
              <ul className={screen.plain}>
                {shown.map(u => (
                  <li key={u.code} className={styles.setRow}>
                    <span className={styles.setText}>
                      <span>{u.name}</span>
                      <span className={styles.setSub}>{typeLabel(u.setType)} · {t.ungrouped.neededCards(u.neededCards)}</span>
                    </span>
                    <Menu
                      variant="text"
                      label={t.ungrouped.addToLabel(u.name)}
                      sheetTitle={u.name}
                      trigger={<>{t.ungrouped.addTo}<span aria-hidden="true">▾</span></>}
                      items={addToItems(u)}
                    />
                  </li>
                ))}
              </ul>
              {filtered.length > PREVIEW_ROWS && (
                <div>
                  <Button variant="text" onClick={() => setShowAll(v => !v)}>{showAll ? t.ungrouped.showFewer : t.ungrouped.showAll(filtered.length)}</Button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

interface GroupCardProps {
  name: string;
  holds: number;
  sets: { code: string; name: string }[];
  addable: readonly SetUsage[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}

// One binder: its name (saved when you leave the field), the sets in it and how many needed cards it could hold.
function GroupCard({ name, holds, sets, addable, onRename, onDelete, onAdd, onRemove }: GroupCardProps) {
  const [draft, setDraft] = useState(name);
  const commit = () => { if (draft.trim() === '') setDraft(name); else if (draft !== name) onRename(draft); };
  return (
    <li className={styles.groupCard}>
      <div className={styles.groupHead}>
        <Input
          label={t.nameLabel}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        />
        <Button variant="text" aria-label={t.deleteGroup(name)} onClick={onDelete}>{t.delete}</Button>
      </div>
      <p className={styles.sectionDetail}>{t.holds(holds)}</p>
      <ul className={screen.plain}>
        {sets.map(set => (
          <li key={set.code} className={styles.setRow}>
            <span>{set.name}</span>
            <Button variant="icon" aria-label={t.removeSet(set.name, name)} onClick={() => onRemove(set.code)}>✕</Button>
          </li>
        ))}
      </ul>
      <AddSet label={t.addSetLabel(name)} sets={addable} onAdd={onAdd} />
    </li>
  );
}

// A picker of sets that have no place yet; choosing one adds it and the picker goes back to its prompt.
function AddSet({ label, sets, onAdd }: { label: string; sets: readonly SetUsage[]; onAdd: (code: string) => void }) {
  if (sets.length === 0) return <p className={styles.sectionDetail}>{t.noSetsLeft}</p>;
  return (
    <Select label={label} value="" onChange={e => { if (e.target.value) onAdd(e.target.value); }}>
      <option value="">{t.addSet}</option>
      {sets.map(u => <option key={u.code} value={u.code}>{u.name}</option>)}
    </Select>
  );
}
