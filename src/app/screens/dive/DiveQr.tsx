// Taking your phone? A QR code that opens this dive on another device. The lists travel inside the link, so no account is
// needed, and nothing is sent to a server. A dive too big for a QR code can still be copied as a link.
import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { buildHandoff } from '../../../core/handoff';
import { Button, useToast } from '../../components';
import { copyText } from '../../clipboard';
import { copy } from '../../copy/en';
import { useLists } from '../../data/ListsProvider';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { encodeHandoff, handoffLink } from '../../handoff/codec';
import styles from './Dive.module.css';

const t = copy.qr;
// Past this many characters the code gets too dense to scan quickly in a store.
export const QR_MAX_CHARS = 1400;

export function qrSvg(text: string): string | null {
  if (text.length > QR_MAX_CHARS) return null;
  try {
    const code = qrcode(0, 'L');
    code.addData(text);
    code.make();
    return code.createSvgTag({ scalable: true, margin: 2 });
  } catch {
    return null;
  }
}

export function DiveQr() {
  const { lists } = useLists();
  const { settings } = useStoreSettings();
  const toast = useToast();
  const handoff = useMemo(() => buildHandoff(lists, settings), [lists, settings]);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    if (handoff.lists.length === 0) return;
    void encodeHandoff(handoff).then(encoded => { if (current) setLink(handoffLink(window.location.origin, encoded)); });
    return () => { current = false; };
  }, [handoff]);

  if (handoff.lists.length === 0 || link === null) return null;
  const svg = qrSvg(link);

  return (
    <section className={styles.section} aria-label={t.title}>
      <h3 className={styles.subTitle}>{t.title}</h3>
      <p className={styles.sectionDetail}>{t.text}</p>
      {svg ? (
        <div role="img" aria-label={t.label} className={styles.qr} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <p className={styles.sectionDetail}>{t.tooBig}</p>
      )}
      <div>
        <Button variant="text" onClick={() => { void copyText(link).then(ok => toast.show({ message: ok ? t.copied : t.copyFailed })); }}>{t.copyLink}</Button>
      </div>
    </section>
  );
}
