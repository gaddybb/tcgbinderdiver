// TEMPORARY: a plain paste box so My lists has real lists to work with. The import flow (a later step) replaces it,
// and brings the card lookup, name fixing and per-card status. Until then a card is identified by its name.
import { useState } from 'react';
import { combineEntries, parseDecklist, nameKey } from '../../core/parse/parseDecklist';
import type { IncomingEntry } from '../../core/lists';
import { Button, Dialog, Input, Radio } from '../components';
import { copy } from '../copy/en';
import { useLists } from '../data/ListsProvider';
import { useToast } from '../components';

interface PasteDialogProps {
  open: boolean;
  onClose: () => void;
  onLimitReached: () => void;
}

const t = copy.pasteDialog;

export function PasteDialog({ open, onClose, onLimitReached }: PasteDialogProps) {
  const lists = useLists();
  const toast = useToast();
  const [target, setTarget] = useState<'deck' | 'wishlist'>('deck');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [textError, setTextError] = useState<string>();

  const reset = () => { setTarget('deck'); setName(''); setText(''); setNameError(undefined); setTextError(undefined); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    setNameError(undefined);
    setTextError(undefined);
    if (target === 'deck' && !name.trim()) { setNameError(t.nameMissing); return; }
    if (!text.trim()) { setTextError(t.empty); return; }

    const combined = combineEntries(parseDecklist(text).entries, { sideboard: false, maybeboard: false });
    if (combined.length === 0) { setTextError(t.noNames); return; }
    const incoming: IncomingEntry[] = combined.map(c => ({ cardKey: nameKey(c.name), name: c.name, quantity: c.quantity, tags: c.tags }));

    if (target === 'wishlist') {
      const result = await lists.addToWishlist(incoming);
      if (result.kept < result.total) toast.show({ message: copy.myLists.toast.keptFirst(result.kept, result.total) });
    } else {
      const result = await lists.createDeck(name, incoming);
      if (result.status === 'limit') { close(); onLimitReached(); return; }
      if (result.kept < result.total) toast.show({ message: copy.myLists.toast.keptFirst(result.kept, result.total) });
    }
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t.title}
      actions={
        <>
          <Button variant="secondary" onClick={close}>{copy.common.cancel}</Button>
          <Button onClick={submit}>{target === 'wishlist' ? t.addToWishlist : t.add}</Button>
        </>
      }
    >
      <div role="radiogroup" aria-label={t.addTo}>
        <Radio label={t.newDeck} name="paste-target" checked={target === 'deck'} onChange={() => setTarget('deck')} />
        <Radio label={t.wishlist} name="paste-target" checked={target === 'wishlist'} onChange={() => setTarget('wishlist')} />
      </div>
      {target === 'deck' && (
        <Input label={t.nameLabel} placeholder={t.namePlaceholder} value={name} error={nameError} onChange={e => setName(e.target.value)} />
      )}
      <Input label={t.textLabel} hint={t.textHint} multiline rows={6} value={text} error={textError} onChange={e => setText(e.target.value)} />
    </Dialog>
  );
}
