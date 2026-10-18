import { CARD_STATUSES } from '../../core/status';
import type { CardStatus } from '../../core/status';
import { copy } from '../copy/en';
import { Menu } from './Menu';
import { StatusLabel } from './StatusLabel';

interface StatusPickerProps {
  cardName: string;
  status: CardStatus;
  onChange: (status: CardStatus) => void;
}

// A card's status as a button: it shows the current one, and opens the five choices with a line about each.
// On a phone the choices open as a bottom sheet titled with the card's name.
export function StatusPicker({ cardName, status, onChange }: StatusPickerProps) {
  return (
    <Menu
      variant="text"
      showHints
      sheetTitle={cardName}
      label={copy.statusPicker.label(cardName, copy.status[status])}
      trigger={<><StatusLabel status={status} /><span aria-hidden="true">▾</span></>}
      items={CARD_STATUSES.map(s => ({
        label: copy.status[s],
        hint: copy.statusHint[s],
        checked: s === status,
        onSelect: () => { if (s !== status) onChange(s); },
      }))}
    />
  );
}
