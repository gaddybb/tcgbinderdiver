// /open: the page a hand-off link or QR code lands on. It shows what is in the link and adds it to this device on request.
import { useEffect, useState } from 'react';
import { handoffCards, toIncoming } from '../../../core/handoff';
import type { Handoff } from '../../../core/handoff';
import { Banner, Button, EmptyState, PageHeader, SkeletonRow, useToast } from '../../components';
import { copy } from '../../copy/en';
import { useLists } from '../../data/ListsProvider';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { decodeHandoff } from '../../handoff/codec';
import { navigate } from '../../router';
import screen from '../Screen.module.css';

const t = copy.openHandoff;

export function OpenHandoff() {
  const lists = useLists();
  const store = useStoreSettings();
  const toast = useToast();
  const [state, setState] = useState<{ status: 'reading' } | { status: 'bad' } | { status: 'ready'; handoff: Handoff }>({ status: 'reading' });
  const [limit, setLimit] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void decodeHandoff(window.location.hash.slice(1)).then(handoff => {
      if (current) setState(handoff ? { status: 'ready', handoff } : { status: 'bad' });
    });
    return () => { current = false; };
  }, []);

  if (state.status === 'reading') return <SkeletonRow />;
  if (state.status === 'bad') {
    return (
      <>
        <PageHeader title={t.title} />
        <EmptyState title={t.bad.title} actions={<Button onClick={() => navigate('/lists')}>{t.bad.action}</Button>}>{t.bad.text}</EmptyState>
      </>
    );
  }

  const { handoff } = state;
  const add = async () => {
    setBusy(true);
    try {
      for (const list of handoff.lists) {
        if (list.kind === 'wishlist') { await lists.addToWishlist(toIncoming(list)); continue; }
        const result = await lists.createDeck(list.name, toIncoming(list));
        if (result.status === 'limit') { setLimit(true); return; }
      }
      if (handoff.settings) { const next = handoff.settings; store.update(() => next); }
      toast.show({ message: t.added(handoff.lists.length) });
      navigate('/plan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t.title} subtitle={t.detail(handoff.lists.length, handoffCards(handoff))} />
      <div className={screen.stack}>
        {limit && <Banner tone="error" title={copy.myLists.limitReached.title}>{copy.myLists.limitReached.detail}</Banner>}
        <ul className={screen.plain}>
          {handoff.lists.map(list => <li key={list.name}>{t.listLine(list.name, list.entries.length)}</li>)}
        </ul>
        {handoff.settings && <p className={screen.lead}>{t.settingsNote}</p>}
        <div>
          <Button disabled={busy} onClick={() => { void add(); }}>{t.add}</Button>
          <Button variant="text" onClick={() => navigate('/lists')}>{t.cancel}</Button>
        </div>
      </div>
    </>
  );
}
