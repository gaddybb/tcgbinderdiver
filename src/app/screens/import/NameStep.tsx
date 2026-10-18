import { useMemo } from 'react';
import { chunkForLimit, overLimit } from '../../../core/import';
import { checkPaste } from '../../../core/import';
import { Button, Input, Radio, Switch } from '../../components';
import { copy } from '../../copy/en';
import type { ImportTarget, LimitChoice } from './draft';
import styles from './Import.module.css';

const t = copy.importFlow.name;

export interface NameForm {
  target: ImportTarget;
  name: string;
  text: string;
  sideboard: boolean;
  maybeboard: boolean;
  limitChoice: LimitChoice;
}

interface NameStepProps {
  form: NameForm;
  onChange: (form: NameForm) => void;
  attempted: boolean;          // Look up was pressed, so problems with the paste are shown
  unreadable: boolean;         // the lookup ran and no name matched a card
  nameError: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function NameStep({ form, onChange, attempted, unreadable, nameError, onSubmit, onCancel }: NameStepProps) {
  const check = useMemo(() => checkPaste(form.text, { sideboard: form.sideboard, maybeboard: form.maybeboard }), [form.text, form.sideboard, form.maybeboard]);
  const set = (change: Partial<NameForm>) => onChange({ ...form, ...change });
  const ready = check.status === 'ready' ? check : null;
  const sections = check.status === 'ready' || check.status === 'nothing_included' ? check.sections : null;
  const lines = ready?.entries.length ?? 0;
  const parts = ready && overLimit(lines) ? chunkForLimit(ready.entries).map(p => p.length) : null;

  return (
    <div className={styles.flow}>
      <section className={styles.group}>
        <h2 className={styles.heading}>{t.title}</h2>
        <p className={styles.lead}>{t.lead}</p>
      </section>

      <fieldset className={styles.group}>
        <legend className={styles.subheading}>{t.addTo}</legend>
        <div className={styles.choices}>
          <Radio label={t.newDeck} name="import-target" checked={form.target === 'deck'} onChange={() => set({ target: 'deck' })} />
          <Radio label={t.wishlist} name="import-target" checked={form.target === 'wishlist'} onChange={() => set({ target: 'wishlist' })} />
        </div>
      </fieldset>

      {form.target === 'deck' && (
        <Input
          label={t.nameLabel}
          placeholder={t.namePlaceholder}
          value={form.name}
          error={nameError ? copy.importFlow.nameMissing : undefined}
          onChange={e => set({ name: e.target.value })}
        />
      )}

      <Input
        label={t.textLabel}
        hint={t.textHint}
        multiline
        rows={10}
        value={form.text}
        error={attempted && check.status === 'empty' ? `${t.empty.title}. ${t.empty.detail}` : undefined}
        onChange={e => set({ text: e.target.value })}
      />

      {sections && (sections.sideboard > 0 || sections.maybeboard > 0) && (
        <fieldset className={styles.group}>
          <legend className={styles.subheading}>{t.sections}</legend>
          <div className={styles.sections}>
            <div className={styles.sectionRow}><span>{t.mainDeck(sections.main)}</span><span className={styles.sectionNote}>{t.mainDeckNote}</span></div>
            {sections.sideboard > 0 && (
              <div className={styles.sectionRow}>
                <Switch label={t.sideboard(sections.sideboard)} checked={form.sideboard} onChange={sideboard => set({ sideboard })} />
              </div>
            )}
            {sections.maybeboard > 0 && (
              <div className={styles.sectionRow}>
                <Switch label={t.maybeboard(sections.maybeboard)} checked={form.maybeboard} onChange={maybeboard => set({ maybeboard })} />
                <span className={styles.sectionNote}>{t.maybeboardNote}</span>
              </div>
            )}
          </div>
        </fieldset>
      )}

      {ready && (
        <section className={styles.panel} aria-live="polite">
          <p className={styles.counts}>{t.ready(lines)}</p>
          {ready.combined.map(c => <p key={c.name} className={styles.note}>{t.combined(c.name, c.times, c.quantity)}</p>)}
          <p className={styles.note}>{t.cleaned}</p>
          {form.target === 'wishlist' && <p className={styles.note}>{t.wishlistNote}</p>}
        </section>
      )}

      {parts && (
        <fieldset className={styles.panel}>
          <legend className={styles.subheading}>{t.tooMany.legend}</legend>
          <p className={styles.counts}>{t.tooMany.title(lines)}</p>
          <p className={styles.note}>{t.tooMany.detail}</p>
          <div className={styles.choices}>
            <Radio label={t.tooMany.split(parts)} name="import-limit" checked={form.limitChoice === 'split'} onChange={() => set({ limitChoice: 'split' })} />
            <Radio label={t.tooMany.keepFirst} name="import-limit" checked={form.limitChoice === 'first'} onChange={() => set({ limitChoice: 'first' })} />
          </div>
        </fieldset>
      )}

      {(unreadable || (attempted && check.status === 'no_names')) && <UnreadablePanel />}
      {attempted && check.status === 'nothing_included' && (
        <section className={styles.panel} role="alert">
          <p className={styles.counts}>{t.nothingIncluded.title}</p>
          <p className={styles.note}>{t.nothingIncluded.detail}</p>
        </section>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>{copy.importFlow.cancel}</Button>
        <span className={styles.actionsEnd}>
          <span className={styles.note}>{t.nothingSaved}</span>
          <Button onClick={onSubmit}>{ready ? t.lookUp(lines) : t.lookUpEmpty}</Button>
        </span>
      </div>
    </div>
  );
}

function UnreadablePanel() {
  const n = copy.importFlow.name.noNames;
  return (
    <section className={styles.panel} role="alert">
      <p className={styles.counts}>{n.title}</p>
      <p className={styles.note}>{n.detail}</p>
      <ul className={styles.examples}>{n.examples.map(example => <li key={example}>{example}</li>)}</ul>
      <p className={styles.note}>{n.tip}</p>
    </section>
  );
}
