import { copy } from '../copy/en';
import { Button } from './Button';
import styles from './SelectHeader.module.css';

interface SelectHeaderProps {
  count: number;
  allSelected: boolean;
  onClose: () => void;
  onToggleAll: () => void;
}

// The phone's header while choosing cards: close, how many, and Select all (Select none once everything is chosen).
export function SelectHeader({ count, allSelected, onClose, onToggleAll }: SelectHeaderProps) {
  return (
    <div className={styles.header}>
      <Button variant="icon" quiet aria-label={copy.bulk.exitSelect} onClick={onClose}>✕</Button>
      <strong role="status" className={styles.count}>{copy.bulk.selectedShort(count)}</strong>
      <Button variant="text" onClick={onToggleAll}>{allSelected ? copy.bulk.deselectAll : copy.bulk.selectAll}</Button>
    </div>
  );
}
