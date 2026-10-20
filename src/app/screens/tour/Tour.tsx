// The guided tours: the screen dims, the thing each tip talks about is lit up, and the tip sits next to it.
// One tour per screen (dive, list, plan). Skipping or finishing one is remembered on this device through the storage seam.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, TourTip } from '../../components';
import { copy } from '../../copy/en';
import { usePreference } from '../../data/usePreference';
import styles from './Tour.module.css';

export type TourId = 'dive' | 'list' | 'plan';

// The data-tour value of the element each tip points at, in tip order. Missing on screen means a centered tip.
const TARGETS: Record<TourId, string[]> = {
  dive: ['dive-picker', 'dive-cards', 'dive-finish'],
  list: ['list-controls', 'list-cards', 'list-plan'],
  plan: ['plan-stops', 'plan-settings', 'plan-start'],
};

interface Box { top: number; left: number; width: number; height: number }

// The target's box on screen, scrolled into view first when it is off screen. null when there is nothing to point at.
function measure(name: string | undefined): Box | null {
  const el = name ? document.querySelector<HTMLElement>(`[data-tour="${name}"]`) : null;
  if (!el) return null;
  let r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  if (r.bottom < 0 || r.top > window.innerHeight) { el.scrollIntoView?.({ block: 'center' }); r = el.getBoundingClientRect(); }
  // A box taller than the screen is lit only as far as it shows.
  const top = Math.max(r.top, 0);
  const bottom = Math.min(r.bottom, window.innerHeight);
  return { top, left: r.left, width: r.width, height: Math.max(bottom - top, 0) };
}

// Next to the box: below it when it is in the top half, above it when in the bottom half, docked at the bottom when it fills the screen.
function place(box: Box | null): { className: string; style?: CSSProperties } {
  if (!box) return { className: styles.centered };
  const left = `clamp(var(--space-3), ${box.left}px, calc(100vw - var(--size-tip-w) - var(--space-3)))`;
  const vh = window.innerHeight;
  if (box.top + box.height < vh * 0.55) return { className: styles.tip, style: { top: `calc(${box.top + box.height}px + var(--space-3))`, left } };
  if (box.top > vh * 0.45) return { className: styles.tip, style: { bottom: `calc(${vh - box.top}px + var(--space-3))`, left } };
  return { className: styles.docked };
}

interface TourPlayerProps {
  id: TourId;
  onDone: () => void;      // after Skip, Escape, or the last tip
}

export function TourPlayer({ id, onDone }: TourPlayerProps) {
  const t = copy.tourFlow[id];
  const [step, setStep] = useState(0);   // 0 is the welcome, then one per tip
  const [box, setBox] = useState<Box | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const total = t.tips.length;
  const target = step > 0 ? TARGETS[id][step - 1] : undefined;

  // Follow the target as the page resizes or scrolls.
  useLayoutEffect(() => {
    const update = () => setBox(measure(target));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [target]);

  // Escape skips. Focus moves into the tip on each step and goes back where it was when the tour ends.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDone]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.();
  }, []);
  useEffect(() => {
    const buttons = root.current?.querySelectorAll('button');
    buttons?.[buttons.length - 1]?.focus();
  }, [step]);

  const spot = place(box);
  return (
    <div ref={root} className={styles.root} role="region" aria-label={t.label}>
      <div className={`${styles.backdrop} ${box ? '' : styles.dim}`} />
      {box && (
        <div
          className={styles.hole}
          data-testid="tour-spotlight"
          style={{ top: `calc(${box.top}px - var(--space-1))`, left: `calc(${box.left}px - var(--space-1))`, width: `calc(${box.width}px + 2 * var(--space-1))`, height: `calc(${box.height}px + 2 * var(--space-1))` }}
        />
      )}
      <div className={spot.className} style={spot.style}>
        {step === 0 ? (
          <div className={styles.welcome}>
            <strong>{t.welcomeTitle}</strong>
            <span>{t.welcomeText}</span>
            <div className={styles.welcomeActions}>
              <Button variant="secondary" onClick={onDone}>{copy.tourFlow.skip}</Button>
              <Button onClick={() => setStep(1)}>{copy.tourFlow.show}</Button>
            </div>
            <span>{copy.tourFlow.replayNote}</span>
          </div>
        ) : (
          <TourTip
            step={step}
            total={total}
            title={t.tips[step - 1].title}
            onSkip={onDone}
            onNext={() => (step >= total ? onDone() : setStep(step + 1))}
          >
            {t.tips[step - 1].text}
          </TourTip>
        )}
      </div>
    </div>
  );
}

// The tour for a screen, shown on the first visit on this device until it is skipped or finished.
// Stored like any small choice (not a cookie), so it needs no consent banner.
export function Tour({ id }: { id: TourId }) {
  const [seen, setSeen, loaded] = usePreference<'no' | 'yes'>(`tour-${id}`, 'no');
  if (!loaded || seen === 'yes') return null;
  return <TourPlayer id={id} onDone={() => setSeen('yes')} />;
}
