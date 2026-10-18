// The frame of card detail: a full screen on a phone, a panel beside the list on a tablet or desktop. A modal, so focus
// stays inside it and Escape closes it. Previous and next walk the cards the player came from.
import { useId } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../components';
import { useModal } from '../../components/useModal';
import { copy } from '../../copy/en';
import { cx } from '../../cx';
import { useLayout } from '../../layout/useLayout';
import styles from './CardDetail.module.css';

const t = copy.cardDetail;

interface CardDetailShellProps {
  position: string;                 // "Card 1 of 13"
  onClose: () => void;
  onPrevious?: () => void;          // left out when there is no card before this one
  onNext?: () => void;
  footer?: ReactNode;
  children: (titleId: string) => ReactNode;
}

export function CardDetailShell({ position, onClose, onPrevious, onNext, footer, children }: CardDetailShellProps) {
  const phone = useLayout() === 'phone';
  const titleId = useId();
  const panelRef = useModal(true, onClose);

  const close = <Button variant="icon" aria-label={t.close} onClick={onClose}>✕</Button>;
  const previous = <Button variant="icon" aria-label={t.previous} disabled={!onPrevious} onClick={onPrevious}>‹</Button>;
  const next = <Button variant="icon" aria-label={t.next} disabled={!onNext} onClick={onNext}>›</Button>;

  return createPortal(
    <div className={styles.scrim} onMouseDown={event => { if (!phone && event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cx(styles.panel, !phone && styles.side)}>
        <header className={styles.header}>
          {phone && close}
          <span className={cx(styles.position, phone && styles.positionPhone)}>{position}</span>
          {previous}
          {next}
          {!phone && close}
        </header>
        <div className={styles.body}>{children(titleId)}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
