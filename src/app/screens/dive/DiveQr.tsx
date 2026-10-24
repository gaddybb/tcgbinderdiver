// Taking your phone? A QR code that opens this dive on another device. The lists travel inside the link, so no account is
// needed, and nothing is sent to a server. A dive too big for a QR code can still be copied as a link.
import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { buildHandoff } from '../../../core/handoff';
import { Button, useToast } from '../../components';
import { copyText } from '../../clipboard';
import { copy } from '../../copy/en';
import { useConnector } from '../../data/CardDataProvider';
import { useLists } from '../../data/ListsProvider';
import { useGame } from '../../data/useGame';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { encodeHandoff, handoffLink } from '../../handoff/codec';
import styles from './Dive.module.css';

const t = copy.qr;
// Past this many characters the code gets too dense to scan. 2400 is about a 36th-size code (169 squares across), which a phone
// reads fine from a screen when the code is shown this large (see --size-qr): about 330 cards in a compact link.
export const QR_MAX_CHARS = 2400;
// In modules: the blank border a scanner needs, the gap between blocks, and how round each block's corners are.
const QUIET_ZONE = 2;
const BLOCK_GAP = 0.1;
const BLOCK_ROUND = 0.2;

export function qrSvg(text: string): string | null {
  if (text.length > QR_MAX_CHARS) return null;
  try {
    const code = qrcode(0, 'L');
    code.addData(text);
    code.make();
    // Each dark square is its own rounded block with a hairline gap, so it reads chunkier than the plain pixel grid.
    const count = code.getModuleCount();
    const size = count + 2 * QUIET_ZONE;
    let blocks = '';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (code.isDark(row, col)) blocks += `<rect x="${col + QUIET_ZONE + BLOCK_GAP / 2}" y="${row + QUIET_ZONE + BLOCK_GAP / 2}" width="${1 - BLOCK_GAP}" height="${1 - BLOCK_GAP}" rx="${BLOCK_ROUND}"/>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="currentColor">${blocks}</svg>`;
  } catch {
    return null;
  }
}

export function DiveQr() {
  const { lists } = useLists();
  const { settings } = useStoreSettings();
  const toast = useToast();
  const [game] = useGame();
  const connector = useConnector();
  const handoff = useMemo(() => buildHandoff(lists, settings, game), [lists, settings, game]);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    if (handoff.lists.length === 0) return;
    // With the card catalog on this device the link carries card fingerprints, so even a big deck fits in the code; without it, names.
    void (async () => {
      const index = await connector.fingerprintIndex?.();
      const encoded = await encodeHandoff(handoff, index != null);
      if (current) setLink(handoffLink(window.location.origin, encoded));
    })();
    return () => { current = false; };
  }, [handoff, connector]);

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
