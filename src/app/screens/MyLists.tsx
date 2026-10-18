import { useEffect, useState } from 'react';
import { copyAsText, isValidListName, nextDiveSummary, WISHLIST_ID } from '../../core/lists';
import type { CardList } from '../../core/lists';
import {
  Banner, Button, Dialog, EmptyState, ListCard, Menu, PageHeader, SkeletonRow, SummaryBar, useToast,
} from '../components';
import type { MenuItem } from '../components';
import { copyText } from '../clipboard';
import { copy } from '../copy/en';
import { useLists } from '../data/ListsProvider';
import { useStorage } from '../data/StorageProvider';
import { joinNames, listSummaryLine } from '../format';
import { useLayout } from '../layout/useLayout';
import { navigate } from '../router';
import { checkPaste } from '../../core/import';
import { clearDraft, loadDraft } from './import/draft';
import type { ImportDraft } from './import/draft';
import styles from './Screen.module.css';

const t = copy.myLists;

type Confirm = { kind: 'delete' | 'clear'; list: CardList };

export function MyLists() {
  const lists = useLists();
  const toast = useToast();
  const phone = useLayout() === 'phone';

  const storage = useStorage();
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string; error?: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [limit, setLimit] = useState(false);

  // An import that was started and not finished (the lookup stopped, or the player left).
  useEffect(() => {
    let current = true;
    void loadDraft(storage).then(saved => { if (current) setDraft(saved ?? null); });
    return () => { current = false; };
  }, [storage]);
  const unfinished = draft && checkPaste(draft.text, draft.include).status === 'ready' ? draft : null;
  const paste = () => navigate('/import');

  const now = lists.now();
  const summary = nextDiveSummary(lists.lists);
  const wishlist = lists.lists.find(l => l.id === WISHLIST_ID);
  const hasContent = lists.lists.some(l => l.kind === 'deck') || (wishlist?.entries.length ?? 0) > 0;

  const saveRename = async () => {
    if (!renaming) return;
    if (!isValidListName(renaming.value)) { setRenaming({ ...renaming, error: copy.importFlow.nameMissing }); return; }
    await lists.rename(renaming.id, renaming.value);
    setRenaming(null);
  };

  const copyList = async (list: CardList) => {
    const ok = await copyText(copyAsText(list));
    toast.show({ message: ok ? t.toast.copied : t.toast.copyFailed });
  };

  const duplicate = async (list: CardList) => {
    const result = await lists.duplicate(list.id);
    if (result?.status === 'limit') setLimit(true);
    else if (result) toast.show({ message: t.toast.duplicated(result.list.name) });
  };

  const menuFor = (list: CardList): MenuItem[] => [
    { label: t.menu.rename, onSelect: () => setRenaming({ id: list.id, value: list.name }) },
    { label: t.menu.duplicate, hint: t.menu.duplicateHint(list.name), onSelect: () => duplicate(list) },
    { label: t.menu.copyAsText, hint: t.menu.copyAsTextHint, onSelect: () => copyList(list) },
    list.kind === 'wishlist'
      ? { label: t.menu.clearWishlist, hint: t.menu.confirmHint, danger: true, onSelect: () => setConfirm({ kind: 'clear', list }) }
      : { label: t.menu.delete, hint: t.menu.confirmHint, danger: true, onSelect: () => setConfirm({ kind: 'delete', list }) },
  ];

  const summaryBar = (
    <SummaryBar
      sticky={phone}
      title={summary.listCount > 0 ? t.next(summary.listCount, summary.cardCount) : t.nextNone}
      detail={summary.listCount > 0 && !phone ? joinNames(summary.listNames) : undefined}
      // Opens the dive plan; the store dive itself starts from there.
      action={<Button disabled={summary.listCount === 0} onClick={() => navigate('/plan')}>{t.startDive}</Button>}
    />
  );

  const dialog = confirm && (confirm.kind === 'delete' ? t.deleteDialog : t.clearDialog);

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={phone ? t.subtitlePhone : t.subtitle}
        actions={<Button onClick={paste}>{phone ? t.pasteNewPhone : t.pasteNew}</Button>}
      />

      <div className={styles.stack}>
        {!lists.persistent && <Banner tone="warning" title={copy.storage.notSavedTitle}>{copy.storage.notSavedDetail}</Banner>}
        {limit && <Banner tone="error" title={t.limitReached.title}>{t.limitReached.detail}</Banner>}
        {unfinished && (
          <Banner
            tone="info"
            title={copy.resume.title(unfinished.name || copy.resume.unnamedWishlist)}
            actions={
              <>
                <Button variant="secondary" onClick={() => navigate('/import?resume=1')}>{copy.resume.action}</Button>
                <Button variant="text" onClick={async () => { await clearDraft(storage); setDraft(null); }}>{copy.resume.discard}</Button>
              </>
            }
          >
            {copy.resume.detail(unfinished.done, unfinished.total)}
          </Banner>
        )}

        {!lists.ready ? <SkeletonRow /> : !hasContent ? (
          <EmptyState title={t.empty.title} actions={<Button onClick={paste}>{t.empty.action}</Button>}>
            {t.empty.text}
          </EmptyState>
        ) : (
          <>
            {!phone && summaryBar}
            <ul className={styles.cards}>
              {lists.lists.map(list => (
                <ListCard
                  key={list.id}
                  kindLabel={t.kind[list.kind]}
                  title={list.name}
                  to={`/lists/${list.id}`}
                  summary={listSummaryLine(list, now)}
                  thumbs={[]}
                  inNextDive={list.inNextDive}
                  onInNextDiveChange={on => lists.setInNextDive(list.id, on)}
                  menu={<Menu label={copy.common.moreFor(list.name)} sheetTitle={list.name} items={menuFor(list)} />}
                  rename={renaming?.id === list.id ? {
                    value: renaming.value,
                    error: renaming.error,
                    onChange: value => setRenaming({ id: list.id, value }),
                    onSave: saveRename,
                    onCancel: () => setRenaming(null),
                  } : undefined}
                />
              ))}
            </ul>
            {phone && summaryBar}
          </>
        )}
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? (confirm.kind === 'delete' ? t.deleteDialog.title(confirm.list.name) : t.clearDialog.title) : ''}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>{dialog?.keep}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm) return;
                if (confirm.kind === 'delete') await lists.remove(confirm.list.id);
                else await lists.clearWishlist();
                setLimit(false);
                setConfirm(null);
              }}
            >
              {dialog?.confirm}
            </Button>
          </>
        }
      >
        {confirm && (
          <>
            {confirm.kind === 'delete' ? t.deleteDialog.body(confirm.list.entries.length) : t.clearDialog.body(confirm.list.entries.length)}
            <br />
            <br />
            {dialog?.tip}
          </>
        )}
      </Dialog>
    </>
  );
}
