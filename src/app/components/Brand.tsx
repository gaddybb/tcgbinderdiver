import { copy } from '../copy/en';
import { cx } from '../cx';
import styles from './Brand.module.css';

// Placeholder brand art for the illustration pass. Original shapes only: never a publisher's logo or symbol.
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <svg aria-hidden="true" className={styles[size]} viewBox="0 0 64 64">
      <circle className={styles.helmet} cx="32" cy="28" r="22" />
      <circle className={styles.lens} cx="32" cy="28" r="11" />
      <path className={styles.crossbar} d="M32 17v22M21 28h22" />
      <path className={styles.collar} d="M14 50h36l-4 8H18z" />
    </svg>
  );
}

const NODES = [
  { x: 66, y: 28, tone: styles.nodeWhite },
  { x: 104, y: 55.6, tone: styles.nodeBlue },
  { x: 89.5, y: 100.4, tone: styles.nodeBlack },
  { x: 42.5, y: 100.4, tone: styles.nodeRed },
  { x: 28, y: 55.6, tone: styles.nodeGreen },
];

// The Magic section's anchor: a pentagon of five coral nodes, one per color. Original art.
export function GameAnchor() {
  return (
    <svg role="img" aria-label={copy.kit.sample.anchorLabel} className={styles.anchor} viewBox="0 0 132 132">
      <circle className={styles.disc} cx="66" cy="66" r="64" />
      <circle className={styles.tintDisc} cx="66" cy="66" r="58" />
      <polygon className={styles.star} points="66,28 104,55.6 89.5,100.4 42.5,100.4 28,55.6" />
      <polyline className={styles.starLines} points="66,28 89.5,100.4 28,55.6 104,55.6 42.5,100.4 66,28" />
      {NODES.map(n => <circle key={n.tone} className={cx(n.tone)} cx={n.x} cy={n.y} r="10" />)}
      {NODES.map(n => <circle key={`s${n.tone}`} className={styles.shine} cx={n.x - 3} cy={n.y - 3} r="3" />)}
      <circle className={styles.hub} cx="66" cy="68" r="6" />
    </svg>
  );
}
