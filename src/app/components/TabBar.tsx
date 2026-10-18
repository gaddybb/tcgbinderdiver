import { copy } from '../copy/en';
import { Link } from '../router';
import styles from './TabBar.module.css';

export interface TabItem {
  id: string;
  label: string;
  to: string;
}

interface TabBarProps {
  items: readonly TabItem[];
  current: string;
  label?: string;
}

// The phone tab bar: Lists, Plan, Dive and More. The current tab is named for screen readers, not only colored.
export function TabBar({ items, current, label = copy.tabs.label }: TabBarProps) {
  return (
    <nav aria-label={label} className={styles.bar}>
      {items.map(item => (
        <Link key={item.id} to={item.to} className={styles.tab} aria-current={item.id === current ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
