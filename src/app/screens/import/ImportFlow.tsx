// The import flow at /import: Name it, Look up cards, Fix names and (for decks) What you own.
// The logic is in src/core/import; this screen holds the player's choices and calls the connector.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkPaste, chunkForLimit, needsFixing, noneMatched, overLimit, resolvedEntries, toIncoming,
} from '../../../core/import';
import type { ImportLine, StatusChoices } from '../../../core/import';
import { WISHLIST_ID } from '../../../core/lists';
import type { CardList } from '../../../core/lists';
import type { CombinedEntry } from '../../../core/parse/parseDecklist';
import { Banner, PageHeader, StepIndicator, useToast } from '../../components';
import { copy } from '../../copy/en';
import { useConnector } from '../../data/CardDataProvider';
import { useLists } from '../../data/ListsProvider';
import { useStorage } from '../../data/StorageProvider';
import { navigate } from '../../router';
import { useAnalytics } from '../../analytics/AnalyticsProvider';
import { clearDraft, loadDraft, saveDraft } from './draft';
import { clearImportText, peekImportText } from './handoff';
import type { ImportDraft } from './draft';
import { FixStep } from './FixStep';
import { LookupStep } from './LookupStep';
import { NameStep } from './NameStep';
import type { NameForm } from './NameStep';
import { OwnStep } from './OwnStep';
import screen from '../Screen.module.css';

const t = copy.importFlow;
type Step = 'name' | 'lookup' | 'fix' | 'own';
const ORDER: readonly Step[] = ['name', 'lookup', 'fix', 'own'];

const emptyForm = (wishlist: boolean): NameForm => ({
  target: wishlist ? 'wishlist' : 'deck', name: '', text: '', sideboard: false, maybeboard: false, limitChoice: 'split',
});

export function ImportFlow() {
  const lists = useLists();
  const storage = useStorage();
  const connector = useConnector();
  const toast = useToast();
  const analytics = useAnalytics();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [resuming, setResuming] = useState(params.get('resume') === '1');
  const [form, setForm] = useState<NameForm>(() => ({ ...emptyForm(params.get('target') === 'wishlist'), text: peekImportText() }));
  useEffect(() => { clearImportText(); }, []);
  const [step, setStep] = useState<Step>('name');
  const [attempted, setAttempted] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [entries, setEntries] = useState<CombinedEntry[]>([]);
  const [lines, setLines] = useState<ImportLine[]>([]);
  const [choices, setChoices] = useState<StatusChoices>(new Map());
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(false);
  const draftRef = useRef<ImportDraft | null>(null);

  const draftFrom = useCallback((f: NameForm, total: number, done: number): ImportDraft => ({
    target: f.target, name: f.name, text: f.text, include: { sideboard: f.sideboard, maybeboard: f.maybeboard },
    limitChoice: f.limitChoice, done, total, savedAt: lists.now().toISOString(),
  }), [lists]);

  // Moves to the lookup with the cards the paste holds, and keeps a draft so the import can be picked up later.
  const startLookup = useCallback((f: NameForm, found: CombinedEntry[]) => {
    const next = draftFrom(f, found.length, 0);
    draftRef.current = next;
    void saveDraft(storage, next);
    setEntries(found);
    setUnreadable(false);
    setStep('lookup');
    analytics.track('list_pasted', { cards: found.length, target: f.target });
  }, [draftFrom, storage, analytics]);

  // Resume: restore what was filled in and go straight to the lookup.
  useEffect(() => {
    if (!resuming) return;
    let cancelled = false;
    loadDraft(storage).then(saved => {
      if (cancelled) return;
      setResuming(false);
      if (!saved) return;
      const restored: NameForm = { target: saved.target, name: saved.name, text: saved.text, sideboard: saved.include.sideboard, maybeboard: saved.include.maybeboard, limitChoice: saved.limitChoice };
      setForm(restored);
      const check = checkPaste(saved.text, saved.include);
      if (check.status === 'ready') startLookup(restored, check.entries);
    });
    return () => { cancelled = true; };
  }, [resuming, storage, startLookup]);

  const submitName = () => {
    setAttempted(true);
    const needsName = form.target === 'deck' && form.name.trim() === '';
    setNameError(needsName);
    const check = checkPaste(form.text, { sideboard: form.sideboard, maybeboard: form.maybeboard });
    if (needsName || check.status !== 'ready') return;
    startLookup(form, check.entries);
  };

  const cancel = async () => {
    await clearDraft(storage);
    navigate('/lists');
  };

  const finish = async (finalLines: readonly ImportLine[], finalChoices: StatusChoices) => {
    setBusy(true);
    try {
      const incoming = toIncoming(resolvedEntries(finalLines), finalChoices);
      if (form.target === 'wishlist') {
        const result = await lists.addToWishlist(incoming);
        toast.show({ message: t.done.wishlist(result.added, result.skipped) });
        await clearDraft(storage);
        navigate(`/lists/${WISHLIST_ID}`);
        return;
      }
      if (overLimit(incoming.length) && form.limitChoice === 'split') {
        const parts = chunkForLimit(incoming);
        for (const [i, part] of parts.entries()) {
          const result = await lists.createDeck(t.done.splitName(form.name, i + 1, parts.length), part);
          if (result.status === 'limit') { setLimit(true); return; }
        }
        toast.show({ message: t.done.split(parts.length, incoming.length) });
        await clearDraft(storage);
        navigate('/lists');
        return;
      }
      const result = await lists.createDeck(form.name, incoming);
      if (result.status === 'limit') { setLimit(true); return; }
      const created: CardList = result.list;
      toast.show({ message: result.kept < result.total ? t.done.keptFirst(result.kept, result.total) : t.done.deck(created.name, result.kept) });
      await clearDraft(storage);
      navigate(`/lists/${created.id}`);
    } finally {
      setBusy(false);
    }
  };

  const afterFix = (finalLines: readonly ImportLine[]) => {
    if (form.target === 'deck') setStep('own');
    else void finish(finalLines, new Map());
  };

  const onLookupDone = (found: ImportLine[]) => {
    if (noneMatched(found)) {
      void clearDraft(storage);
      setUnreadable(true);
      setAttempted(true);
      setStep('name');
      return;
    }
    setLines(found);
    setChoices(new Map());
    if (needsFixing(found)) setStep('fix');
    else if (form.target === 'deck') setStep('own');
    else void finish(found, new Map());
  };

  const onProgress = useCallback((done: number) => {
    if (!draftRef.current) return;
    draftRef.current = { ...draftRef.current, done };
    void saveDraft(storage, draftRef.current);
  }, [storage]);

  const saveForLater = async (done: number) => {
    await saveDraft(storage, draftFrom(form, entries.length, done));
    toast.show({ message: t.lookup.trouble.savedToast });
    navigate('/lists');
  };

  const backToName = () => {
    void clearDraft(storage);
    setStep('name');
  };

  const stepNames = form.target === 'deck'
    ? [t.steps.name, t.steps.lookup, t.steps.fix, t.steps.own]
    : [t.steps.name, t.steps.lookup, t.steps.fix];
  const resolved = resolvedEntries(lines);

  return (
    <>
      <PageHeader title={t.title} />
      <div className={screen.stack}>
        <StepIndicator steps={stepNames} current={ORDER.indexOf(step)} label={t.stepsLabel} />
        {limit && <Banner tone="error" title={t.limitReached.title}>{t.limitReached.detail}</Banner>}

        {resuming ? null : step === 'name' ? (
          <NameStep form={form} onChange={f => { setForm(f); setUnreadable(false); }} attempted={attempted} unreadable={unreadable} nameError={nameError} onSubmit={submitName} onCancel={() => { void cancel(); }} />
        ) : step === 'lookup' ? (
          <LookupStep
            entries={entries}
            connector={connector}
            onDone={onLookupDone}
            onProgress={onProgress}
            onBack={backToName}
            onCancel={() => { void cancel(); }}
            onSaveForLater={done => { void saveForLater(done); }}
          />
        ) : step === 'fix' ? (
          <FixStep
            lines={lines}
            onChange={setLines}
            connector={connector}
            canContinue={resolved.length > 0 && !busy}
            onBack={backToName}
            onContinue={() => afterFix(lines)}
          />
        ) : (
          <OwnStep
            entries={resolved}
            choices={choices}
            onChange={setChoices}
            busy={busy}
            onBack={() => setStep(needsFixing(lines) ? 'fix' : 'name')}
            onFinish={c => { void finish(lines, c); }}
          />
        )}
      </div>
    </>
  );
}
