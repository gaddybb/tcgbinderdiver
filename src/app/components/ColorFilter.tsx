import { copy } from '../copy/en';
import { COLOR_CATEGORIES } from './colors';
import type { ColorCategory } from './colors';
import styles from './ColorFilter.module.css';

interface ColorFilterProps {
  selected: readonly ColorCategory[];
  onToggle: (category: ColorCategory) => void;
}

// One button per store-sort category. Each is named in full for screen readers and shows one letter.
export function ColorFilter({ selected, onToggle }: ColorFilterProps) {
  return (
    <div role="group" aria-label={copy.colors.groupLabel} className={styles.group}>
      {COLOR_CATEGORIES.map(category => (
        <button
          key={category}
          type="button"
          className={styles.button}
          aria-pressed={selected.includes(category)}
          aria-label={copy.colors[category].name}
          onClick={() => onToggle(category)}
        >
          {copy.colors[category].letter}
        </button>
      ))}
    </div>
  );
}
