import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLayout } from '../layout/useLayout';
import styles from './HoverPreview.module.css';

interface HoverPreviewProps {
  src: string | null;        // the larger picture
  children: ReactNode;       // what the pointer goes over: a card thumbnail in a table row
}

const GAP = 24;

// Is a pointer that can hover available? Phones and most tablets say no.
const canHover = (): boolean => typeof window.matchMedia !== 'function' || window.matchMedia('(hover: hover)').matches;

// The width the preview is drawn at, from the --size-preview-w token, in pixels (to keep it inside the window).
function previewWidth(): number {
  const root = getComputedStyle(document.documentElement);
  const value = root.getPropertyValue('--size-preview-w').trim();
  const rem = parseFloat(root.fontSize) || 16;
  return value.endsWith('rem') ? parseFloat(value) * rem : parseFloat(value) || 288;
}

// A card picture shown larger while the pointer is over its thumbnail, on screens that have a pointer and show tables
// (tablet and desktop). It is decoration: the card's name is always written beside the thumbnail.
export function HoverPreview({ src, children }: HoverPreviewProps) {
  const layout = useLayout();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  if (!src || layout === 'phone' || !canHover()) return <>{children}</>;

  const move = (event: MouseEvent) => {
    const width = previewWidth();
    const height = width * 1.4;
    const x = event.clientX + GAP + width > window.innerWidth ? event.clientX - GAP - width : event.clientX + GAP;
    const y = Math.max(GAP, Math.min(event.clientY - height / 2, window.innerHeight - height - GAP));
    setAt({ x, y });
  };

  return (
    <span className={styles.host} onMouseEnter={move} onMouseMove={move} onMouseLeave={() => setAt(null)}>
      {children}
      {at && createPortal(<img src={src} alt="" aria-hidden="true" className={styles.preview} style={{ left: at.x, top: at.y }} />, document.body)}
    </span>
  );
}
