import { useId } from 'react';
import type { ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from './useModal';
import styles from './Overlay.module.css';

interface SheetPanelProps {
  title: string;
  children?: ReactNode;
  // Set by Sheet when the panel is a real modal. Left out when the kit gallery shows the panel in place.
  modal?: { panelRef: Ref<HTMLDivElement>; titleId: string };
}

// The look of a bottom sheet, on its own so the kit gallery can show it in place.
export const SheetPanel = ({ title, children, modal }: SheetPanelProps) => (
  <div
    ref={modal?.panelRef}
    className={styles.sheet}
    {...(modal ? { role: 'dialog', 'aria-modal': true, 'aria-labelledby': modal.titleId, tabIndex: -1 } : {})}
  >
    <div aria-hidden="true" className={styles.handle} />
    <strong id={modal?.titleId} className={styles.sheetTitle}>{title}</strong>
    {children && <div className={styles.sheetBody}>{children}</div>}
  </div>
);

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}

// Phone menus, pickers and settings slide up from the bottom. Tapping outside, or Escape, closes it.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useModal(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className={`${styles.scrim} ${styles.scrimSheet}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <SheetPanel title={title} modal={{ panelRef, titleId }}>{children}</SheetPanel>
    </div>,
    document.body,
  );
}
