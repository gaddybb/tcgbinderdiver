import { useId } from 'react';
import type { ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from './useModal';
import styles from './Overlay.module.css';

interface DialogPanelProps {
  title: string;
  children?: ReactNode;   // the explanation
  actions?: ReactNode;    // buttons, the main one last
  // Set by Dialog when the panel is a real modal. Left out when the kit gallery shows the panel in place.
  modal?: { panelRef: Ref<HTMLDivElement>; titleId: string };
}

// The look of a dialog, on its own so the kit gallery can show it in place.
export const DialogPanel = ({ title, children, actions, modal }: DialogPanelProps) => (
  <div
    ref={modal?.panelRef}
    className={styles.dialog}
    {...(modal ? { role: 'dialog', 'aria-modal': true, 'aria-labelledby': modal.titleId, tabIndex: -1 } : {})}
  >
    <strong id={modal?.titleId} className={styles.dialogTitle}>{title}</strong>
    {children && <div className={styles.dialogBody}>{children}</div>}
    {actions && <div className={styles.dialogActions}>{actions}</div>}
  </div>
);

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

// Only for choices that can't be undone or need a decision (delete a list, end a trip). Everything else is inline.
export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const titleId = useId();
  const panelRef = useModal(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className={`${styles.scrim} ${styles.scrimDialog}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <DialogPanel title={title} actions={actions} modal={{ panelRef, titleId }}>{children}</DialogPanel>
    </div>,
    document.body,
  );
}
